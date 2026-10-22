import { eq, sql } from 'drizzle-orm';
import { pgSchema, text, uuid } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './testing';
import { withTenant } from './tenant';

const demoTest = pgSchema('demo_test');
const item = demoTest.table('item', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
});

const tenantA = '00000000-0000-4000-8000-00000000000a';
const tenantB = '00000000-0000-4000-8000-00000000000b';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.db.execute(sql`create schema demo_test`);
  await testDb.db.execute(
    sql`create table demo_test.item (id uuid primary key default gen_random_uuid(), tenant_id uuid not null, name text not null)`,
  );
});

afterAll(async () => {
  await testDb?.cleanup();
});

describe('migrations', () => {
  it('create the platform tables in an empty database', async () => {
    const { rows } = await testDb.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'platform' order by table_name`,
    );
    expect(rows.map((row) => row.table_name)).toEqual([
      'demo_session',
      'event',
      'mock_message',
    ]);
  });
});

describe('withTenant', () => {
  it('sets the tenant id on inserts', async () => {
    await withTenant(testDb.db, tenantA).insert(item, [
      { name: 'A1' },
      { name: 'A2' },
    ]);
    await withTenant(testDb.db, tenantB).insert(item, { name: 'B1' });
    const all = await testDb.db.select().from(item);
    expect(all.filter((row) => row.tenantId === tenantA)).toHaveLength(2);
    expect(all.filter((row) => row.tenantId === tenantB)).toHaveLength(1);
  });

  it("never returns or changes another tenant's rows", async () => {
    const a = withTenant(testDb.db, tenantA);
    expect((await a.select(item)).map((row) => row.name).sort()).toEqual([
      'A1',
      'A2',
    ]);
    expect(await a.select(item, eq(item.name, 'B1'))).toEqual([]);

    await a.update(item, { name: 'changed' }, eq(item.name, 'B1'));
    await a.delete(item, eq(item.name, 'B1'));
    const [b1] = await withTenant(testDb.db, tenantB).select(item);
    expect(b1?.name).toBe('B1');

    await a.delete(item);
    expect(await a.select(item)).toEqual([]);
    expect(await withTenant(testDb.db, tenantB).select(item)).toHaveLength(1);
  });

  it('works inside a transaction', async () => {
    await testDb.db.transaction(async (tx) => {
      await withTenant(tx, tenantA).insert(item, { name: 'in tx' });
    });
    expect(
      await withTenant(testDb.db, tenantA).select(item, eq(item.name, 'in tx')),
    ).toHaveLength(1);
  });
});
