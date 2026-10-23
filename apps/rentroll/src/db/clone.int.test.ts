import { getDemoTenant } from '@peera/db';
import { createTestDb, type TestDb } from '@peera/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoApp } from './demo-app';
import { rentrollMigrations } from './migrations';
import { buildSeed, TEMPLATE_TENANT_ID } from './seed/generator';
import { insertSeed } from './seed/insert';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb([rentrollMigrations]);
  const data = buildSeed();
  await testDb.db.transaction((tx) => insertSeed(tx, data));
});

afterAll(async () => {
  await testDb?.cleanup();
});

async function countsFor(tenantId: string) {
  const { rows } = await testDb.db.execute<{ table: string; n: number }>(sql`
    select 'room' as "table", count(*)::int as n from rentroll.room where tenant_id = ${tenantId}::uuid
    union all select 'contract', count(*)::int from rentroll.contract where tenant_id = ${tenantId}::uuid
    union all select 'invoice', count(*)::int from rentroll.invoice where tenant_id = ${tenantId}::uuid
    union all select 'meter_reading', count(*)::int from rentroll.meter_reading where tenant_id = ${tenantId}::uuid`);
  return Object.fromEntries(rows.map((r) => [r.table, r.n]));
}

async function unbalancedInvoices(tenantId: string) {
  const { rows } = await testDb.db.execute<{ id: string }>(sql`
    select i.id from rentroll.invoice i
    left join rentroll.invoice_line il on il.invoice_id = i.id
    where i.tenant_id = ${tenantId}::uuid
    group by i.id, i.total_satang
    having i.total_satang <> coalesce(sum(il.amount_satang), 0)`);
  return rows;
}

describe('demo tenant clone', () => {
  it('copies the apartment template with the same counts and balanced invoices', async () => {
    const templateCounts = await countsFor(TEMPLATE_TENANT_ID);
    expect(templateCounts.room).toBe(44);

    const { tenantId } = await getDemoTenant(testDb.db, demoApp, {
      sid: crypto.randomUUID(),
      variant: 'apartment',
    });
    expect(tenantId).not.toBe(TEMPLATE_TENANT_ID);
    expect(await countsFor(tenantId)).toEqual(templateCounts);
    expect(await unbalancedInvoices(tenantId)).toEqual([]);

    await testDb.db.execute(sql`select rentroll.delete_demo_tenant(${tenantId}::uuid)`);
    expect(await countsFor(tenantId)).toEqual({
      room: 0,
      contract: 0,
      invoice: 0,
      meter_reading: 0,
    });
  });
});
