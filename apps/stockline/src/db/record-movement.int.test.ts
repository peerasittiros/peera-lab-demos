import { createTestDb, type TestDb } from '@peera/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stocklineMigrations } from './migrations';
import { buildSeedVariant, TEMPLATE_TENANTS } from './seed/generator';
import { insertSeed } from './seed/insert';

// 02 §10: concurrent moves on one item never corrupt item_balance. Real parallel transactions (the pool holds up to
// ten connections) call stockline.record_movement on the same item; each holds its transaction open a moment after
// the call, so the next ones wait on the balance row lock rather than running one after another by chance.

let testDb: TestDb;
const tenant = TEMPLATE_TENANTS.minimart;
/** Marks the test's own movements, apart from the seed's history of the same item. */
const TEST_NOTE = 'concurrency test';

beforeAll(async () => {
  testDb = await createTestDb([stocklineMigrations]);
  await testDb.db.transaction((tx) =>
    insertSeed(tx, buildSeedVariant('minimart')),
  );
});

afterAll(async () => {
  await testDb?.cleanup();
});

async function pickItem(offset: number) {
  const { rows } = await testDb.db.execute<{
    item_id: string;
    on_hand: number;
  }>(sql`
    select item_id, on_hand from stockline.item_balance
    where tenant_id = ${tenant}::uuid order by item_id offset ${offset} limit 1`);
  return rows[0]!;
}

async function onHand(itemId: string) {
  const { rows } = await testDb.db.execute<{ on_hand: number }>(
    sql`select on_hand from stockline.item_balance where item_id = ${itemId}::uuid`,
  );
  return rows[0]!.on_hand;
}

async function ledgerTotal(itemId: string) {
  const { rows } = await testDb.db.execute<{ total: number }>(
    sql`select coalesce(sum(quantity_base), 0)::int as total from stockline.stock_movement where item_id = ${itemId}::uuid`,
  );
  return rows[0]!.total;
}

function move(itemId: string, type: 'in' | 'out', quantity: number) {
  return testDb.db.transaction(async (tx) => {
    const { rows } = await tx.execute<{ balance: number }>(sql`
      select stockline.record_movement(${tenant}::uuid, ${itemId}::uuid, ${type}, ${type === 'in' ? 'received' : 'sold'},
        ${quantity}::int, null, ${TEST_NOTE}) as balance`);
    await tx.execute(sql`select pg_sleep(0.02)`);
    return rows[0]!.balance;
  });
}

describe('stockline.record_movement under concurrency', () => {
  it('keeps item_balance equal to the ledger when many moves on one item run at once', async () => {
    const { item_id: itemId, on_hand: before } = await pickItem(0);
    const ledgerBefore = await ledgerTotal(itemId);
    expect(ledgerBefore).toBe(before);

    // 30 ins of 3 and 20 outs of 2, interleaved: +50 in all.
    const moves = Array.from({ length: 50 }, (_, i) =>
      i % 5 < 3 ? move(itemId, 'in', 3) : move(itemId, 'out', -2),
    );
    await Promise.all(moves);

    expect(await onHand(itemId)).toBe(before + 30 * 3 - 20 * 2);
    expect(await ledgerTotal(itemId)).toBe(await onHand(itemId));
  });

  it('gives every concurrent move its own running balance, with no lost update', async () => {
    const { item_id: itemId, on_hand: before } = await pickItem(1);
    const balances = await Promise.all(
      Array.from({ length: 25 }, () => move(itemId, 'in', 1)),
    );
    // Each call saw a different balance: exactly before+1 … before+25, once each.
    expect([...balances].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, i) => before + i + 1),
    );
    const { rows } = await testDb.db.execute<{ balance_after: number }>(sql`
      select balance_after from stockline.stock_movement
      where item_id = ${itemId}::uuid and note = ${TEST_NOTE} order by balance_after`);
    expect(rows.map((row) => row.balance_after)).toEqual(
      [...balances].sort((a, b) => a - b),
    );
  });

  it('refuses an item of another tenant and leaves both balances alone', async () => {
    const { item_id: itemId, on_hand: before } = await pickItem(2);
    await expect(
      testDb.db.execute(sql`
        select stockline.record_movement(${TEMPLATE_TENANTS.cafe}::uuid, ${itemId}::uuid, 'in', 'received', 5)`),
    ).rejects.toThrow();
    expect(await onHand(itemId)).toBe(before);
  });
});
