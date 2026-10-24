import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../../../packages/db/src/testing';
import { rentrollMigrations } from './migrations';
import { SNAPSHOT_TABLES } from './snapshot-tables';
import { TEMPLATE_TENANT_ID, buildSeed } from './seed/generator';
import { insertSeed } from './seed/insert';
import { relativizeSeed } from './seed/relativize';

/**
 * Parity between the two ways of making a visitor's copy of the template (SPEC §2.1, Spec correction 13): the SQL
 * `rentroll.clone_demo_tenant` (used by the server before the browser store) and the TypeScript port `relativizeSeed`
 * (used for the daily snapshot now). Both run on the same seed and the same Bangkok day; they must agree on how many
 * rows each table has and on the values the owner reads: invoice numbers, periods, dates, amounts and status, meter
 * readings and contracts.
 *
 * Needs the local Postgres (`DATABASE_URL`, see packages/db/src/testing.ts). Run with `pnpm test:integration`.
 */

const TODAY = new Date().toLocaleDateString('en-CA', {
  timeZone: 'Asia/Bangkok',
});

let testDb: TestDb;
let cloneId: string;

type Row = Record<string, unknown>;

async function rowsOf(query: ReturnType<typeof sql>): Promise<Row[]> {
  const result = await testDb.db.execute(query);
  return result.rows as Row[];
}

const num = (value: unknown) => Number(value);

beforeAll(async () => {
  testDb = await createTestDb([rentrollMigrations]);
  await testDb.db.transaction((tx) => insertSeed(tx, buildSeed()));
  cloneId = randomUUID();
  await testDb.db.execute(
    sql`select rentroll.clone_demo_tenant(${TEMPLATE_TENANT_ID}::uuid, ${cloneId}::uuid)`,
  );
}, 120_000);

afterAll(async () => {
  await testDb?.cleanup();
});

describe('clone parity: rentroll.clone_demo_tenant vs relativizeSeed', () => {
  // The TypeScript side, for the same day the SQL clone sees (Bangkok's today).
  const snapshot = relativizeSeed(buildSeed(), TODAY);

  it('copies the same number of rows into every snapshot table', async () => {
    for (const { name } of SNAPSHOT_TABLES) {
      const [counted] = await rowsOf(
        sql`select count(*)::int as n from ${sql.raw(`rentroll.${name}`)} where tenant_id = ${cloneId}::uuid`,
      );
      expect(counted?.n, name).toBe(
        snapshot[name as keyof typeof snapshot]?.length ?? 0,
      );
    }
  });

  it('gives the same invoices: numbers, periods, dates, amounts and status', async () => {
    const sqlInvoices = await rowsOf(sql`
      select number, period, to_char(issue_date, 'YYYY-MM-DD') as issue_date,
        to_char(due_date, 'YYYY-MM-DD') as due_date, total_satang, paid_satang, status
      from rentroll.invoice where tenant_id = ${cloneId}::uuid
      order by number`);
    const tsInvoices = [...(snapshot.invoice ?? [])]
      .map((i) => ({
        number: i.number,
        period: i.period,
        issue_date: i.issueDate,
        due_date: i.dueDate,
        total_satang: i.totalSatang,
        paid_satang: i.paidSatang,
        status: i.status,
      }))
      .sort((a, b) => String(a.number).localeCompare(String(b.number)));
    expect(sqlInvoices.length).toBeGreaterThan(0);
    expect(
      sqlInvoices.map((r) => ({
        ...r,
        period: String(r.period).trim(),
        total_satang: num(r.total_satang),
        paid_satang: num(r.paid_satang),
      })),
    ).toEqual(
      tsInvoices.map((r) => ({
        ...r,
        period: String(r.period).trim(),
        total_satang: num(r.total_satang),
        paid_satang: num(r.paid_satang),
      })),
    );
  });

  it('gives the same meter readings, by room number', async () => {
    const sqlReadings = await rowsOf(sql`
      select r.number as room, m.kind, m.period, m.reading, m.units_used
      from rentroll.meter_reading m join rentroll.room r on r.id = m.room_id
      where m.tenant_id = ${cloneId}::uuid`);
    const roomNumber = new Map(
      (snapshot.room ?? []).map((r) => [r.id, r.number]),
    );
    const tsReadings = (snapshot.meter_reading ?? []).map((m) => ({
      room: roomNumber.get(m.roomId),
      kind: m.kind,
      period: m.period,
      reading: num(m.reading),
      units_used: m.unitsUsed === null ? null : num(m.unitsUsed),
    }));
    const key = (r: { room: unknown; kind: unknown; period: unknown }) =>
      `${r.room}|${r.kind}|${r.period}`;
    const normalise = (rows: Row[]) =>
      rows
        .map((r) => ({
          room: r.room,
          kind: r.kind,
          period: String(r.period).trim(),
          reading: num(r.reading),
          units_used: r.units_used === null ? null : num(r.units_used),
        }))
        .sort((a, b) => key(a).localeCompare(key(b)));
    expect(sqlReadings.length).toBeGreaterThan(0);
    expect(normalise(sqlReadings)).toEqual(normalise(tsReadings));
  });
});
