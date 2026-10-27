import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  approveCount,
  saveCountLine,
  startCount,
  submitCount,
} from './count-commands';
import { recordMovement } from './commands';
import { createMemoryPersistence } from './idb';
import { createStore, type Store } from './store';
import { seedSnapshot, TEST_NOW } from './testing';
import { countDetail, countViews } from './views';

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

async function startAll(blind = false) {
  const result = await startCount(
    store,
    { scope: { kind: 'all' }, blind },
    'staff',
    { now: () => TEST_NOW },
  );
  if (!result.ok) throw new Error('count did not start');
  return result.data.id;
}

/** Counts every line of a session. `quantity` gets the expected quantity recorded when the count started. */
async function countAll(id: string, quantity: (expected: number) => number) {
  const lines = ledger().entities.count[id]!.lines as {
    itemId: string;
    expected: number;
  }[];
  for (const line of lines) {
    await saveCountLine(
      store,
      id,
      line.itemId,
      quantity(line.expected),
      'staff',
    );
  }
}

describe('starting a count', () => {
  it('lists the active items with the stock they had at the start', async () => {
    const id = await startAll();
    const detail = countDetail(ledger(), id, 'owner')!;
    expect(detail.lines.length).toBe(
      Object.values(ledger().entities.item).filter(
        (row) => row.active !== false,
      ).length,
    );
    expect(detail.number).toMatch(/^CNT-\d{4}$/);
    expect(
      detail.lines.every(
        (line) => line.expected === ledger().balances[line.itemId],
      ),
    ).toBe(true);
  });

  it('starts one category only', async () => {
    const categoryId = String(
      Object.values(ledger().entities.item).find((row) => row.categoryId)!
        .categoryId,
    );
    const result = await startCount(
      store,
      { scope: { kind: 'category', categoryId }, blind: false },
      'staff',
    );
    expect(result.ok).toBe(true);
    const detail = countDetail(
      ledger(),
      (result as { data: { id: string } }).data.id,
      'owner',
    )!;
    expect(
      detail.lines.every((line) => line.item.categoryId === categoryId),
    ).toBe(true);
    expect(detail.categoryName).not.toBeNull();
  });

  it('hides the expected quantity on a blind count until a line is counted', async () => {
    const id = await startAll(true);
    const first = countDetail(ledger(), id, 'owner')!.lines[0]!;
    expect(first.expected).toBeNull();
    await saveCountLine(store, id, first.itemId, 3, 'staff');
    expect(
      countDetail(ledger(), id, 'owner')!.lines.find(
        (line) => line.itemId === first.itemId,
      )!.expected,
    ).not.toBeNull();
  });

  it('shows in the list with progress', async () => {
    const id = await startAll();
    const summary = countViews(ledger()).find((row) => row.id === id)!;
    expect(summary).toMatchObject({ status: 'open', counted: 0 });
    expect(summary.total).toBeGreaterThan(0);
  });
});

describe('counting and submitting', () => {
  it('refuses to submit while a line is not counted', async () => {
    const id = await startAll();
    const result = await submitCount(store, id, 'staff');
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'count_incomplete' },
    });
  });

  it('submits once every line is counted, then refuses more counting', async () => {
    const id = await startAll();
    await countAll(id, (expected) => expected);
    expect(await submitCount(store, id, 'staff')).toMatchObject({ ok: true });
    expect(
      await saveCountLine(
        store,
        id,
        countDetail(ledger(), id, 'owner')!.lines[0]!.itemId,
        1,
        'staff',
      ),
    ).toMatchObject({
      ok: false,
      error: { code: 'count_closed' },
    });
  });

  it('refuses a negative count', async () => {
    const id = await startAll();
    const itemId = countDetail(ledger(), id, 'owner')!.lines[0]!.itemId;
    expect(await saveCountLine(store, id, itemId, -1, 'staff')).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
  });
});

describe('approving a count', () => {
  it('is owner only', async () => {
    const id = await startAll();
    await countAll(id, (expected) => expected);
    await submitCount(store, id, 'staff');
    expect(await approveCount(store, id, 'staff')).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });

  it('is refused before the count is submitted', async () => {
    const id = await startAll();
    expect(await approveCount(store, id, 'owner')).toMatchObject({
      ok: false,
      error: { code: 'count_closed' },
    });
  });

  it('changes each balance by exactly the difference, as count movements linked to the session', async () => {
    const id = await startAll();
    const lines = countDetail(ledger(), id, 'owner')!.lines;
    const target = lines.find((line) => (line.expected ?? 0) > 0)!;
    await countAll(id, (expected) =>
      expected === target.expected ? expected + 4 : expected,
    );
    await submitCount(store, id, 'staff');
    const before = Object.fromEntries(
      lines.map((line) => [line.itemId, ledger().balances[line.itemId]!]),
    );

    const result = await approveCount(store, id, 'owner');
    expect(result).toMatchObject({ ok: true });
    expect(ledger().balances[target.itemId]).toBe(before[target.itemId]! + 4);
    const adjusts = ledger().movements.filter(
      (movement) => movement.visitor && movement.reason === 'count',
    );
    expect(adjusts.length).toBe(
      (result as { data: { adjusted: number } }).data.adjusted,
    );
    expect(
      adjusts.every(
        (movement) =>
          movement.type === 'adjust' && movement.countSessionId === id,
      ),
    ).toBe(true);
    expect(
      adjusts.find((movement) => movement.itemId === target.itemId),
    ).toMatchObject({
      quantityBase: 4,
      reference: countDetail(ledger(), id, 'owner')!.number,
    });
    expect(countViews(ledger()).find((row) => row.id === id)!.status).toBe(
      'approved',
    );
  });

  it('keeps a sale recorded while the count was running', async () => {
    const id = await startAll();
    const lines = countDetail(ledger(), id, 'owner')!.lines;
    const target = lines.find((line) => (line.expected ?? 0) >= 2)!;
    await recordMovement(
      store,
      {
        itemId: target.itemId,
        type: 'out',
        reason: 'sold',
        quantity: 1,
        unitId: null,
      },
      'owner',
    );
    await countAll(id, (expected) =>
      expected === target.expected ? target.expected + 1 : expected,
    );
    await submitCount(store, id, 'staff');
    await approveCount(store, id, 'owner');
    // Start E, a sale of 1 (E−1), counted E+1 → the approval adds (E+1)−E, so the balance is E+1−1.
    expect(ledger().balances[target.itemId]).toBe(target.expected);
  });
});
