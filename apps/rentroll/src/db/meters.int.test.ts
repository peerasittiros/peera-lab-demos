import { ActionError, getDemoTenant } from '@peera/db';
import { createTestDb, type TestDb } from '@peera/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoApp } from './demo-app';
import { loadMeterRound, type MeterRoomRow } from './queries/meters';
import { loadProperty } from './queries/property';
import { rentrollMigrations } from './migrations';
import { bangkokDate } from '../domain/dates';
import { buildSeed } from './seed/generator';
import { insertSeed } from './seed/insert';
import { saveMeterReading, type SaveMeterInput } from './writes/meters';

let testDb: TestDb;
let tenantId: string;
let buildingIds: string[];
const today = () => bangkokDate(new Date());
const period = () => today().slice(0, 7);

beforeAll(async () => {
  testDb = await createTestDb([rentrollMigrations]);
  const data = buildSeed();
  await testDb.db.transaction((tx) => insertSeed(tx, data));
  ({ tenantId } = await getDemoTenant(testDb.db, demoApp, { sid: crypto.randomUUID(), variant: 'apartment' }));
  buildingIds = (await loadProperty(testDb.db, tenantId, today())).buildings.map((b) => b.id);
});

afterAll(async () => {
  await testDb?.cleanup();
});

async function round(kind: 'electricity' | 'water' = 'electricity'): Promise<MeterRoomRow[]> {
  const perBuilding = await Promise.all(
    buildingIds.map((id) => loadMeterRound(testDb.db, tenantId, { buildingId: id, kind, period: period() })),
  );
  return perBuilding.flat();
}

function save(row: MeterRoomRow, reading: number, extra: Partial<SaveMeterInput> = {}) {
  return testDb.db.transaction((tx) =>
    saveMeterReading(tx, tenantId, {
      roomId: row.roomId,
      kind: 'electricity',
      period: period(),
      reading,
      rollover: false,
      readBy: 'caretaker',
      readAt: new Date(),
      ...extra,
    }),
  );
}

async function storedRows(roomId: string) {
  const { rows } = await testDb.db.execute<{ reading: number; units_used: number | null; anomaly: string | null }>(sql`
    select reading, units_used, anomaly from rentroll.meter_reading
    where tenant_id = ${tenantId}::uuid and room_id = ${roomId}::uuid and kind = 'electricity' and period = ${period()}`);
  return rows;
}

describe('meter round progress', () => {
  it('lists every room that is not under maintenance; six occupied rooms have no reading yet this month (01 §9)', async () => {
    const rows = await round();
    const { rooms } = await loadProperty(testDb.db, tenantId, today());
    expect(rows).toHaveLength(rooms.filter((r) => !r.maintenance).length);
    const occupied = new Set(rooms.filter((r) => r.status === 'occupied').map((r) => r.id));
    expect(rows.filter((r) => r.current === null && occupied.has(r.roomId))).toHaveLength(6);
  });

  it('reading the missing rooms clears the occupied part of the round', async () => {
    const { rooms } = await loadProperty(testDb.db, tenantId, today());
    const occupied = new Set(rooms.filter((r) => r.status === 'occupied').map((r) => r.id));
    const missing = (await round()).filter((r) => r.current === null && occupied.has(r.roomId));
    for (const row of missing) {
      await save(row, (row.previous ?? 0) + 30);
    }
    const after = await round();
    expect(after.filter((r) => r.current === null && occupied.has(r.roomId))).toHaveLength(0);
  });
});

describe('saveMeterReading', () => {
  it('is idempotent: sending the same reading twice leaves one row with the same units', async () => {
    const row = (await round()).find((r) => r.current !== null && r.previous !== null)!;
    const first = await save(row, row.previous! + 12);
    const second = await save(row, row.previous! + 12);
    expect(second.unitsUsed).toBe(first.unitsUsed);
    const rows = await storedRows(row.roomId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.units_used).toBe(12);
  });

  it('a corrected value overwrites the earlier one for the same month', async () => {
    const row = (await round()).find((r) => r.current !== null && r.previous !== null)!;
    await save(row, row.previous! + 40);
    const rows = await storedRows(row.roomId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.units_used).toBe(40);
  });

  it('refuses a lower reading unless the rollover is confirmed', async () => {
    const row = (await round()).find((r) => r.previous !== null && r.previous > 10)!;
    await expect(save(row, row.previous! - 5)).rejects.toMatchObject({ code: 'meter.lower_needs_rollover' });
    await expect(save(row, row.previous! - 5)).rejects.toBeInstanceOf(ActionError);
  });

  it('wraps a rollover at 10^digits', async () => {
    const row = (await round()).find((r) => r.previous !== null && r.previous > 10 && r.digits === 5)!;
    await save(row, 5, { rollover: true });
    const rows = await storedRows(row.roomId);
    expect(rows[0]!.units_used).toBe(5 + 10 ** 5 - row.previous!);
  });

  it('flags usage far above the three-month average', async () => {
    const row = (await round()).find((r) => r.previous !== null && r.averageUnits !== null && r.previous < 50000)!;
    await save(row, row.previous! + 5000);
    const rows = await storedRows(row.roomId);
    expect(rows[0]!.anomaly).toBe('above_double_average');
  });

  it('refuses a reading for a month that has not started', async () => {
    const row = (await round())[0]!;
    const future = `${Number(period().slice(0, 4)) + 1}-01`;
    await expect(
      testDb.db.transaction((tx) =>
        saveMeterReading(tx, tenantId, {
          roomId: row.roomId,
          kind: 'electricity',
          period: future,
          reading: 1,
          rollover: false,
          readBy: 'caretaker',
          readAt: new Date(),
        }),
      ),
    ).rejects.toMatchObject({ code: 'meter.future_period' });
  });

  it('refuses a reading with more digits than the meter has', async () => {
    const row = (await round())[0]!;
    await expect(save(row, 10 ** row.digits)).rejects.toMatchObject({ code: 'meter.invalid' });
  });
});
