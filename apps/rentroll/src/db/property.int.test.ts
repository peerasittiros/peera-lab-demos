import { ActionError, getDemoTenant } from '@peera/db';
import { createTestDb, type TestDb } from '@peera/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadProperty } from '../db/queries/property';
import { demoApp } from './demo-app';
import { rentrollMigrations } from './migrations';
import { buildSeed } from './seed/generator';
import { insertSeed } from './seed/insert';
import { addRatePlan, saveRoom, setRoomMaintenance } from './writes/property';
import { bangkokDate } from '../domain/dates';
import { ratePlanOn } from '../domain/property';

let testDb: TestDb;
let tenantId: string;
const today = () => bangkokDate(new Date());

beforeAll(async () => {
  testDb = await createTestDb([rentrollMigrations]);
  const data = buildSeed();
  await testDb.db.transaction((tx) => insertSeed(tx, data));
  ({ tenantId } = await getDemoTenant(testDb.db, demoApp, { sid: crypto.randomUUID(), variant: 'apartment' }));
});

afterAll(async () => {
  await testDb?.cleanup();
});

function countBy<T>(rows: T[], key: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[key(row)] = (acc[key(row)] ?? 0) + 1;
    return acc;
  }, {});
}

describe('room map on the seeded apartment', () => {
  it('shows 44 rooms: 38 occupied, 3 vacant, 1 reserved, 2 under maintenance (01 §9)', async () => {
    const { rooms } = await loadProperty(testDb.db, tenantId, today());
    expect(rooms).toHaveLength(44);
    expect(countBy(rooms, (r) => r.status)).toEqual({ occupied: 38, vacant: 3, reserved: 1, maintenance: 2 });
  });

  it('marks maintenance only where the flag is set, and every occupied room has a live contract', async () => {
    const { rooms } = await loadProperty(testDb.db, tenantId, today());
    expect(rooms.filter((r) => r.maintenance).every((r) => r.status === 'maintenance')).toBe(true);
    expect(rooms.filter((r) => r.status === 'occupied').every((r) => r.contractId !== null)).toBe(true);
  });
});

describe('effective-dated rates', () => {
  it('a new plan leaves the old plans and the issued invoices unchanged', async () => {
    const before = await loadProperty(testDb.db, tenantId, today());
    const buildingId = before.buildings[0]!.id;
    const invoiceTotal = async () => {
      const { rows } = await testDb.db.execute<{ total: number }>(
        sql`select coalesce(sum(total_satang), 0)::int as total from rentroll.invoice where tenant_id = ${tenantId}::uuid`,
      );
      return rows[0]!.total;
    };
    const totalBefore = await invoiceTotal();
    const oldPlans = before.ratePlans.filter((p) => p.buildingId === buildingId).map((p) => ({ ...p }));

    await testDb.db.transaction((tx) =>
      addRatePlan(tx, tenantId, {
        buildingId,
        validFrom: '2027-01-01',
        elecRateSatang: 900,
        elecMinSatang: 15000,
        waterMode: 'per_unit',
        waterRateSatang: 1900,
        waterMinSatang: 15000,
        waterPerPersonSatang: 0,
        commonFeeSatang: 0,
        lateFeeRule: { kind: 'per_day', amountSatang: 5000, capSatang: 50000 },
      }),
    );

    const after = await loadProperty(testDb.db, tenantId, today());
    const plans = after.ratePlans.filter((p) => p.buildingId === buildingId);
    expect(plans).toHaveLength(oldPlans.length + 1);
    for (const old of oldPlans) {
      expect(plans.find((p) => p.id === old.id)).toEqual(old);
    }
    expect(await invoiceTotal()).toBe(totalBefore);
    // Before 2027 the old plan still applies; from 2027-01-01 the new one does.
    const sorted = plans.map((p) => ({ id: p.id, validFrom: p.validFrom }));
    expect(ratePlanOn(sorted, '2026-12-31')?.id).toBe(oldPlans.sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]!.id);
    expect(ratePlanOn(sorted, '2027-01-01')?.validFrom).toBe('2027-01-01');
  });

  it('rejects a second plan that starts on the same date', async () => {
    const { buildings } = await loadProperty(testDb.db, tenantId, today());
    const buildingId = buildings[0]!.id;
    const attempt = testDb.db.transaction((tx) =>
      addRatePlan(tx, tenantId, {
        buildingId,
        validFrom: '2027-01-01',
        elecRateSatang: 800,
        elecMinSatang: 0,
        waterMode: 'per_person',
        waterRateSatang: 0,
        waterMinSatang: 0,
        waterPerPersonSatang: 10000,
        commonFeeSatang: 0,
        lateFeeRule: { kind: 'once', amountSatang: 20000, capSatang: 20000 },
      }),
    );
    await expect(attempt).rejects.toMatchObject({ code: 'rate_plan.duplicate_date' });
    await expect(attempt).rejects.toBeInstanceOf(ActionError);
  });
});

describe('room writes', () => {
  it('sets the maintenance flag and moves the room to maintenance', async () => {
    const { rooms } = await loadProperty(testDb.db, tenantId, today());
    const occupied = rooms.find((r) => r.status === 'occupied')!;
    await testDb.db.transaction((tx) => setRoomMaintenance(tx, tenantId, occupied.id, true));
    const updated = (await loadProperty(testDb.db, tenantId, today())).rooms.find((r) => r.id === occupied.id)!;
    expect(updated.status).toBe('maintenance');
    await testDb.db.transaction((tx) => setRoomMaintenance(tx, tenantId, occupied.id, false));
    const restored = (await loadProperty(testDb.db, tenantId, today())).rooms.find((r) => r.id === occupied.id)!;
    expect(restored.status).toBe('occupied');
  });

  it('refuses a room number that already exists in the building', async () => {
    const { rooms } = await loadProperty(testDb.db, tenantId, today());
    const [first, second] = rooms;
    const attempt = testDb.db.transaction((tx) =>
      saveRoom(tx, tenantId, {
        buildingId: first!.buildingId,
        number: first!.number,
        floor: first!.floor,
        roomTypeId: first!.roomTypeId,
        sizeSqm: null,
        elecMeterDigits: 5,
        waterMeterDigits: 4,
        sort: 999,
      }),
    );
    await expect(attempt).rejects.toMatchObject({ code: 'room.duplicate_number' });
    expect(second).toBeDefined();
  });
});
