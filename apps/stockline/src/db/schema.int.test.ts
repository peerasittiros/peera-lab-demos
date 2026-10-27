import { createTestDb, type TestDb } from '@peera/db/testing';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stocklineMigrations } from './migrations';
import { item, itemBalance, stockMovement } from './schema';
import {
  buildSeedVariant,
  STOCKLINE_VARIANTS,
  TEMPLATE_TENANTS,
} from './seed/generator';
import { insertSeed } from './seed/insert';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb([stocklineMigrations]);
  for (const variant of STOCKLINE_VARIANTS)
    await testDb.db.transaction((tx) =>
      insertSeed(tx, buildSeedVariant(variant)),
    );
});

afterAll(async () => {
  await testDb?.cleanup();
});

async function ledgerMismatches(tenantId: string) {
  const { rows } = await testDb.db.execute<{ item_id: string }>(sql`
    select b.item_id from stockline.item_balance b
    left join (select item_id, sum(quantity_base)::int as total from stockline.stock_movement
               where tenant_id = ${tenantId}::uuid group by item_id) m on m.item_id = b.item_id
    where b.tenant_id = ${tenantId}::uuid and b.on_hand <> coalesce(m.total, 0)`);
  return rows;
}

describe('stock ledger', () => {
  it('rejects UPDATE, DELETE and TRUNCATE on stock_movement', async () => {
    const [row] = await testDb.db
      .select({ id: stockMovement.id })
      .from(stockMovement)
      .where(eq(stockMovement.tenantId, TEMPLATE_TENANTS.cafe))
      .limit(1);
    const id = row!.id;
    const message = (error: unknown) =>
      String((error as { cause?: { message?: string } }).cause?.message);
    await expect(
      testDb.db
        .execute(
          sql`update stockline.stock_movement set note = 'x' where id = ${id}::uuid`,
        )
        .catch((error) => Promise.reject(new Error(message(error)))),
    ).rejects.toThrow(/append-only/);
    await expect(
      testDb.db
        .execute(
          sql`delete from stockline.stock_movement where id = ${id}::uuid`,
        )
        .catch((error) => Promise.reject(new Error(message(error)))),
    ).rejects.toThrow(/append-only/);
    await expect(
      testDb.db
        .execute(sql`truncate stockline.stock_movement`)
        .catch((error) => Promise.reject(new Error(message(error)))),
    ).rejects.toThrow(/append-only/);
  });

  it('rejects a movement whose sign does not match its type', async () => {
    const [row] = await testDb.db
      .select()
      .from(item)
      .where(eq(item.tenantId, TEMPLATE_TENANTS.cafe))
      .limit(1);
    await expect(
      testDb.db.insert(stockMovement).values({
        tenantId: TEMPLATE_TENANTS.cafe,
        itemId: row!.id,
        type: 'out',
        reason: 'sold',
        quantityBase: 5,
        occurredAt: new Date(),
        balanceAfter: 0,
      }),
    ).rejects.toThrow();
  });
});

describe('seed', () => {
  it.each(STOCKLINE_VARIANTS)(
    '%s: item_balance equals the ledger sum for every item',
    async (variant) => {
      expect(await ledgerMismatches(TEMPLATE_TENANTS[variant])).toEqual([]);
      const items = await testDb.db
        .select()
        .from(item)
        .where(eq(item.tenantId, TEMPLATE_TENANTS[variant]));
      const balances = await testDb.db
        .select()
        .from(itemBalance)
        .where(eq(itemBalance.tenantId, TEMPLATE_TENANTS[variant]));
      expect(balances).toHaveLength(items.length);
    },
  );

  it('can run twice: templates are replaced, not duplicated', async () => {
    const seed = buildSeedVariant('hardware');
    await testDb.db.transaction((tx) => insertSeed(tx, seed));
    const items = await testDb.db
      .select()
      .from(item)
      .where(eq(item.tenantId, TEMPLATE_TENANTS.hardware));
    expect(items).toHaveLength(seed.items.length);
  });
});
