import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { movingAverageCost } from '../domain/stock';
import { recordMovement } from './commands';
import { createMemoryPersistence } from './idb';
import { createStore, type Store } from './store';
import { seedSnapshot, TEST_NOW } from './testing';

let store: Store;

beforeEach(async () => {
  const snapshot = seedSnapshot('minimart');
  store = createStore({
    persistence: createMemoryPersistence(),
    fetchSnapshot: async () => snapshot,
    now: () => TEST_NOW,
    openChannel: () => null,
  });
  await store.load('minimart');
});

afterEach(() => store.close());

const snapshotOf = () => store.getState().snapshot!;
const ledgerOf = () => store.getState().ledger!;

/** An item with a known balance, and optionally a pack unit. */
function pick(predicate: (itemId: string) => boolean = () => true) {
  const row = snapshotOf().items.find(
    (item) => item.active !== false && predicate(String(item.id)),
  );
  if (!row) throw new Error('no item');
  return { itemId: String(row.id), baseUnitId: String(row.baseUnitId) };
}

describe('recordMovement command', () => {
  it('records an In and moves the balance', async () => {
    const { itemId } = pick();
    const before = ledgerOf().balances[itemId]!;
    const result = await recordMovement(
      store,
      { itemId, type: 'in', reason: 'received', quantity: 3 },
      'staff',
      {
        now: () => TEST_NOW,
      },
    );
    expect(result).toMatchObject({
      ok: true,
      data: { onHand: before + 3, warning: null },
    });
    expect(ledgerOf().balances[itemId]).toBe(before + 3);
    expect(ledgerOf().movements.at(-1)).toMatchObject({
      visitor: true,
      quantityBase: 3,
    });
  });

  it('rejects a reason that does not fit the type', async () => {
    const { itemId } = pick();
    const result = await recordMovement(
      store,
      { itemId, type: 'in', reason: 'sold', quantity: 1 },
      'owner',
    );
    expect(result).toEqual({
      ok: false,
      error: { code: 'reason_required', messageKey: 'errors.reasonRequired' },
    });
  });

  it('requires a note for an adjust', async () => {
    const { itemId } = pick();
    const result = await recordMovement(
      store,
      { itemId, type: 'adjust', reason: 'correction', quantity: -1 },
      'owner',
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'note_required' },
    });
  });

  it('rejects input that the schema refuses', async () => {
    const { itemId } = pick();
    const result = await recordMovement(
      store,
      { itemId, type: 'out', reason: 'sold', quantity: -2 },
      'owner',
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
  });

  it('reports a missing item', async () => {
    const result = await recordMovement(
      store,
      {
        itemId: crypto.randomUUID(),
        type: 'in',
        reason: 'received',
        quantity: 1,
      },
      'owner',
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });

  it('blocks staff from taking stock below zero', async () => {
    const { itemId } = pick((id) => ledgerOf().balances[id] === 0);
    const result = await recordMovement(
      store,
      { itemId, type: 'out', reason: 'sold', quantity: 1 },
      'staff',
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'stock_below_zero' },
    });
    expect(ledgerOf().balances[itemId]).toBe(0);
  });

  it('lets the owner go below zero with a warning', async () => {
    const { itemId } = pick((id) => ledgerOf().balances[id] === 0);
    const result = await recordMovement(
      store,
      { itemId, type: 'out', reason: 'sold', quantity: 2 },
      'owner',
    );
    expect(result).toMatchObject({
      ok: true,
      data: { onHand: -2, warning: 'negative' },
    });
  });

  it('converts a pack unit to base units', async () => {
    const pack = snapshotOf().itemUnits[0]!;
    const itemId = String(pack.itemId);
    const before = ledgerOf().balances[itemId]!;
    const result = await recordMovement(
      store,
      {
        itemId,
        type: 'in',
        reason: 'received',
        quantity: 2,
        unitId: String(pack.unitId),
      },
      'owner',
    );
    expect(result).toMatchObject({
      ok: true,
      data: { quantityBase: Number(pack.factor) * 2 },
    });
    expect(ledgerOf().balances[itemId]).toBe(before + Number(pack.factor) * 2);
  });

  it('keeps an adjust with its sign', async () => {
    const { itemId } = pick((id) => ledgerOf().balances[id]! > 0);
    const before = ledgerOf().balances[itemId]!;
    await recordMovement(
      store,
      {
        itemId,
        type: 'adjust',
        reason: 'correction',
        quantity: -1,
        note: 'counted',
      },
      'owner',
    );
    expect(ledgerOf().balances[itemId]).toBe(before - 1);
  });

  it('records a unit cost for the owner only and moves the average', async () => {
    const { itemId } = pick();
    await recordMovement(
      store,
      { itemId, type: 'in', reason: 'received', quantity: 1, unitCostBaht: 10 },
      'staff',
    );
    expect(ledgerOf().movements.at(-1)!.unitCostSatang).toBeNull();

    const onHand = ledgerOf().balances[itemId]!;
    const costBefore = ledgerOf().entities.item[itemId]!.costSatang as
      number | null;
    await recordMovement(
      store,
      { itemId, type: 'in', reason: 'received', quantity: 1, unitCostBaht: 10 },
      'owner',
    );
    expect(ledgerOf().movements.at(-1)!.unitCostSatang).toBe(1000);
    // The item's cost is the moving average of what it held and what came in (02 §4).
    expect(ledgerOf().entities.item[itemId]!.costSatang).toBe(
      movingAverageCost(onHand, costBefore, 1, 1000),
    );
  });
});
