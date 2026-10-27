import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildReorderList } from '../domain/reorder';
import { createOrders, receiveOrder } from './order-commands';
import { createMemoryPersistence } from './idb';
import { createStore, type Store } from './store';
import { seedSnapshot, TEST_NOW } from './testing';
import { itemViews, onOrderByItem, orderViews, reorderGroups } from './views';

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

const ledger = () => store.getState().ledger!;

/** One item that needs reordering, and its supplier (or none). */
function lowItem() {
  const group = reorderGroups(ledger(), 'owner')[0];
  if (!group || group.lines.length === 0)
    throw new Error('the seed has no item to reorder');
  return { supplierId: group.supplier?.id ?? null, line: group.lines[0]! };
}

describe('reorder list', () => {
  it('matches the domain rule: same groups, lines and suggestions', () => {
    const onOrder = onOrderByItem(ledger());
    const candidates = itemViews(ledger(), 'owner').map((view) => ({
      itemId: view.id,
      supplierId: view.supplierId,
      onHand: view.onHand,
      minQty: view.minQty,
      reorderQty: view.reorderQty,
      packFactor: view.packs.at(-1)?.factor ?? 1,
      onOrder: onOrder.get(view.id) ?? 0,
    }));
    const expected = buildReorderList(
      candidates,
      ledger().settings.lowStockRule,
    );
    const actual = reorderGroups(ledger(), 'owner');
    expect(
      actual.map((group) =>
        group.lines.map((line) => [line.itemId, line.suggested]),
      ),
    ).toEqual(
      expected.map((group) =>
        group.lines.map((line) => [line.itemId, line.suggested]),
      ),
    );
  });

  it('lists an item once it is under its minimum', () => {
    const line = lowItem().line;
    expect(line.onHand).toBeLessThanOrEqual(line.minQty);
    expect(line.suggested).toBeGreaterThan(0);
  });
});

describe('createOrders', () => {
  it('creates one order per supplier, status ordered, expected after the lead time', async () => {
    const { supplierId, line } = lowItem();
    const result = await createOrders(
      store,
      [
        {
          supplierId,
          lines: [{ itemId: line.itemId, qtyBase: line.suggested }],
        },
      ],
      'owner',
      { now: () => TEST_NOW },
    );
    expect(result.ok).toBe(true);
    const [order] = orderViews(ledger(), 'owner');
    expect(order).toMatchObject({
      status: 'ordered',
      number: expect.stringMatching(/^PO-\d{4}$/),
    });
    expect(order!.items[0]!.qtyBase).toBe(line.suggested);
    expect(onOrderByItem(ledger()).get(line.itemId)).toBe(line.suggested);
  });

  it('is owner only', async () => {
    const { line } = lowItem();
    const result = await createOrders(
      store,
      [{ supplierId: null, lines: [{ itemId: line.itemId, qtyBase: 1 }] }],
      'staff',
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'forbidden' } });
  });
});

describe('receiveOrder', () => {
  it('receives in parts: stock moves, the order goes partial, then received', async () => {
    const { supplierId, line } = lowItem();
    const created = await createOrders(
      store,
      [{ supplierId, lines: [{ itemId: line.itemId, qtyBase: 10 }] }],
      'owner',
      { now: () => TEST_NOW },
    );
    const orderId = (created as { data: { created: { id: string }[] } }).data
      .created[0]!.id;
    const lineId = (
      ledger().entities.order[orderId]!.lines as { id: string }[]
    )[0]!.id;
    const before = ledger().balances[line.itemId]!;

    const first = await receiveOrder(
      store,
      orderId,
      [{ lineId, qtyBase: 4 }],
      'staff',
      { now: () => TEST_NOW },
    );
    expect(first).toMatchObject({ ok: true, data: { status: 'partial' } });
    expect(ledger().balances[line.itemId]).toBe(before + 4);
    expect(ledger().movements.at(-1)).toMatchObject({
      reason: 'received',
      quantityBase: 4,
      reference: expect.stringMatching(/^PO-/),
    });

    const second = await receiveOrder(
      store,
      orderId,
      [{ lineId, qtyBase: 6 }],
      'staff',
      { now: () => TEST_NOW },
    );
    expect(second).toMatchObject({ ok: true, data: { status: 'received' } });
    expect(ledger().balances[line.itemId]).toBe(before + 10);
    expect(onOrderByItem(ledger()).get(line.itemId)).toBeUndefined();
  });

  it('refuses more than the open quantity, and a closed order', async () => {
    const { supplierId, line } = lowItem();
    const created = await createOrders(
      store,
      [{ supplierId, lines: [{ itemId: line.itemId, qtyBase: 3 }] }],
      'owner',
    );
    const orderId = (created as { data: { created: { id: string }[] } }).data
      .created[0]!.id;
    const lineId = (
      ledger().entities.order[orderId]!.lines as { id: string }[]
    )[0]!.id;

    expect(
      await receiveOrder(store, orderId, [{ lineId, qtyBase: 4 }], 'owner'),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    await receiveOrder(store, orderId, [{ lineId, qtyBase: 3 }], 'owner');
    expect(
      await receiveOrder(store, orderId, [{ lineId, qtyBase: 1 }], 'owner'),
    ).toMatchObject({
      ok: false,
      error: { code: 'order_closed' },
    });
  });
});
