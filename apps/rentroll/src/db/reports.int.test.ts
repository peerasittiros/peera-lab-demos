import { getDemoTenant } from '@peera/db';
import { createTestDb, type TestDb } from '@peera/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoApp } from './demo-app';
import { rentrollMigrations } from './migrations';
import { loadDashboard, loadDepositsReport, loadRentRoll, loadUtilitiesReport } from './queries/reports';
import { loadProperty } from './queries/property';
import { buildSeed } from './seed/generator';
import { insertSeed } from './seed/insert';
import { toCsv, baht } from '../domain/csv';
import { bangkokDate } from '../domain/dates';

let testDb: TestDb;
let tenantId: string;
const today = () => bangkokDate(new Date());
const period = () => today().slice(0, 7);

beforeAll(async () => {
  testDb = await createTestDb([rentrollMigrations]);
  const data = buildSeed();
  await testDb.db.transaction((tx) => insertSeed(tx, data));
  ({ tenantId } = await getDemoTenant(testDb.db, demoApp, { sid: crypto.randomUUID(), variant: 'apartment' }));
});

afterAll(async () => {
  await testDb?.cleanup();
});

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const { rows } = await testDb.db.execute<{ v: string | number }>(query);
  return Number(rows[0]!.v);
}

describe('dashboard KPIs equal the SQL sums', () => {
  it('billed, collected, outstanding, overdue and occupancy', async () => {
    const d = await loadDashboard(testDb.db, tenantId, period(), today());
    const billed = await scalar(sql`select coalesce(sum(total_satang),0)::bigint as v from rentroll.invoice
      where tenant_id = ${tenantId}::uuid and period = ${period()} and type = 'monthly' and status <> 'void'`);
    const collected = await scalar(sql`select coalesce(sum(paid_satang),0)::bigint as v from rentroll.invoice
      where tenant_id = ${tenantId}::uuid and period = ${period()} and type = 'monthly' and status <> 'void'`);
    const outstanding = await scalar(sql`select coalesce(sum(total_satang - paid_satang),0)::bigint as v from rentroll.invoice
      where tenant_id = ${tenantId}::uuid and status in ('sent','partially_paid')`);
    const overdue = await scalar(sql`select count(*)::bigint as v from rentroll.invoice
      where tenant_id = ${tenantId}::uuid and status in ('sent','partially_paid') and due_date < ${today()}`);
    expect(d.kpis.billedSatang).toBe(billed);
    expect(d.kpis.collectedSatang).toBe(collected);
    expect(d.kpis.outstandingSatang).toBe(outstanding);
    expect(d.kpis.overdueCount).toBe(overdue);

    const { rooms } = await loadProperty(testDb.db, tenantId, today());
    const rentable = rooms.filter((r) => !r.maintenance);
    expect(d.kpis.rentable).toBe(rentable.length);
    expect(d.kpis.occupied).toBe(rentable.filter((r) => r.status === 'occupied').length);
  });

  it('twelve months of revenue, and the to-do counts match their sources', async () => {
    const d = await loadDashboard(testDb.db, tenantId, period(), today());
    expect(d.revenue).toHaveLength(12);
    expect(d.revenue.at(-1)!.period).toBe(period());
    const slips = await scalar(sql`select count(*)::bigint as v from rentroll.payment
      where tenant_id = ${tenantId}::uuid and status = 'pending_review'`);
    expect(d.todo.slipsWaiting).toBe(slips);
  });
});

describe('reports agree with the invoices', () => {
  it('the rent roll totals are the invoice totals for the month', async () => {
    const rows = await loadRentRoll(testDb.db, tenantId, period(), today());
    const billed = await scalar(sql`select coalesce(sum(total_satang),0)::bigint as v from rentroll.invoice
      where tenant_id = ${tenantId}::uuid and period = ${period()} and type = 'monthly' and status <> 'void'`);
    const paid = await scalar(sql`select coalesce(sum(paid_satang),0)::bigint as v from rentroll.invoice
      where tenant_id = ${tenantId}::uuid and period = ${period()} and type = 'monthly' and status <> 'void'`);
    expect(rows.reduce((s, r) => s + r.billedSatang, 0)).toBe(billed);
    expect(rows.reduce((s, r) => s + r.paidSatang, 0)).toBe(paid);
    expect(rows.reduce((s, r) => s + r.outstandingSatang, 0)).toBe(billed - paid);
  });

  it('the utilities report adds up to the electricity and water lines of the month', async () => {
    const rows = await loadUtilitiesReport(testDb.db, tenantId, period());
    const electricity = await scalar(sql`select coalesce(sum(l.amount_satang),0)::bigint as v from rentroll.invoice_line l
      join rentroll.invoice i on i.id = l.invoice_id
      where i.tenant_id = ${tenantId}::uuid and i.period = ${period()} and i.type = 'monthly' and i.status <> 'void' and l.kind = 'electricity'`);
    expect(rows.reduce((s, r) => s + r.electricitySatang, 0)).toBe(electricity);
  });

  it('the deposits report lists every contract that has a deposit', async () => {
    const rows = await loadDepositsReport(testDb.db, tenantId);
    const contracts = await scalar(sql`select count(*)::bigint as v from rentroll.contract
      where tenant_id = ${tenantId}::uuid and (deposit_satang > 0 or deposit_received_satang > 0)`);
    expect(rows.length).toBe(contracts);
  });
});

describe('CSV export', () => {
  it('keeps the Thai names and carries the byte-order mark', async () => {
    const rows = await loadRentRoll(testDb.db, tenantId, period(), today());
    const named = rows.find((r) => r.renterName)!;
    const csv = toCsv(['ห้อง', 'ผู้เช่า'], [[named.roomNumber, named.renterName], [baht(1234500), 'สมชาย, ใจดี']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(named.renterName!);
    expect(csv).toContain('"สมชาย, ใจดี"');
    expect(csv).toContain('12345.00');
  });
});
