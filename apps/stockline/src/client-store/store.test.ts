import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryPersistence,
  openPersistence,
  type Persistence,
} from './idb';
import { createStore, type StoreDeps } from './store';
import { openSyncChannel } from './sync';
import { recordOp, seedSnapshot, TEST_NOW } from './testing';
import type { StocklineVariant } from '../db/seed/generator';

const DAY_MS = 24 * 60 * 60 * 1000;
const stores: { close(): void }[] = [];

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

function makeStore(overrides: Partial<StoreDeps> = {}) {
  const fetchSnapshot = vi.fn(async (variant: string) =>
    seedSnapshot(variant as StocklineVariant, TEST_NOW),
  );
  const store = createStore({
    persistence: createMemoryPersistence(),
    fetchSnapshot,
    now: () => TEST_NOW,
    openChannel: (onMessage) => openSyncChannel(onMessage),
    ...overrides,
  });
  stores.push(store);
  return { store, fetchSnapshot };
}

describe('load', () => {
  it('fetches the snapshot once and reuses it on the same day', async () => {
    const persistence = createMemoryPersistence();
    const { store, fetchSnapshot } = makeStore({ persistence });
    await store.load('minimart');
    expect(store.getState().status).toBe('ready');
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);

    const again = makeStore({ persistence });
    await again.store.load('minimart');
    expect(again.fetchSnapshot).not.toHaveBeenCalled();
  });

  it('starts from the template with no visitor movements', async () => {
    const { store } = makeStore();
    await store.load('minimart');
    const { ledger } = store.getState();
    expect(ledger!.movements.every((movement) => !movement.visitor)).toBe(true);
  });

  it('drops the visitor ops when the variant changes', async () => {
    const persistence = createMemoryPersistence();
    const first = makeStore({ persistence });
    await first.store.load('minimart');
    await first.store.dispatch(recordOp(first.store.getState().snapshot!));

    const second = makeStore({ persistence });
    await second.store.load('cafe');
    expect(await persistence.readOps()).toHaveLength(0);
  });

  it('keeps the visitor ops across a new day and counts the ones it cannot place', async () => {
    const persistence = createMemoryPersistence();
    const yesterday = new Date(TEST_NOW.getTime() - DAY_MS);
    const old = seedSnapshot('minimart', yesterday);
    await persistence.writeSnapshot(old);
    await persistence.writeMeta({
      variant: 'minimart',
      snapshotDate: old.snapshotDate,
    });

    const kept = recordOp(old, { quantityBase: 3 });
    const gone = recordOp(old, { quantityBase: 1 });
    gone.payload.itemId = 'removed-item';
    await persistence.writeOp(kept);
    await persistence.writeOp(gone);

    const { store, fetchSnapshot } = makeStore({ persistence });
    await store.load('minimart');
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(store.getState().skippedOps).toBe(1);
    expect(store.getState().ledger!.applied[kept.id]).toBe(true);
  });

  it('keeps working on yesterday’s copy when the fetch fails', async () => {
    const persistence = createMemoryPersistence();
    const old = seedSnapshot('minimart', new Date(TEST_NOW.getTime() - DAY_MS));
    await persistence.writeSnapshot(old);
    await persistence.writeMeta({
      variant: 'minimart',
      snapshotDate: old.snapshotDate,
    });

    const { store } = makeStore({
      persistence,
      fetchSnapshot: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    await store.load('minimart');
    expect(store.getState().status).toBe('ready');
  });

  it('reports an error when there is no snapshot and the fetch fails', async () => {
    const { store } = makeStore({
      fetchSnapshot: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    await store.load('minimart');
    expect(store.getState().status).toBe('error');
  });
});

describe('dispatch', () => {
  it('persists the op, applies it and notifies subscribers', async () => {
    const persistence = createMemoryPersistence();
    const { store } = makeStore({ persistence });
    await store.load('minimart');
    const listener = vi.fn();
    store.subscribe(listener);

    const op = recordOp(store.getState().snapshot!, { quantityBase: 2 });
    expect(await store.dispatch(op)).toBe('applied');
    expect(await persistence.readOps()).toEqual([op]);
    expect(store.getState().ledger!.applied[op.id]).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it('does nothing for an op it has already applied', async () => {
    const { store } = makeStore();
    await store.load('minimart');
    const op = recordOp(store.getState().snapshot!);
    await store.dispatch(op);
    expect(await store.dispatch(op)).toBe('duplicate');
  });

  it('reset clears the visitor ops and loads the template again', async () => {
    const persistence = createMemoryPersistence();
    const { store } = makeStore({ persistence });
    await store.load('minimart');
    const template = store.getState().ledger!.movements.length;
    await store.dispatch(recordOp(store.getState().snapshot!));

    await store.reset();
    expect(await persistence.readOps()).toHaveLength(0);
    expect(store.getState().ledger!.movements).toHaveLength(template);
  });
});

describe('tabs', () => {
  it('an op recorded in one store appears in another that shares the channel', async () => {
    const { store: first } = makeStore();
    const { store: second } = makeStore();
    await first.load('minimart');
    await second.load('minimart');

    const op = recordOp(first.getState().snapshot!, { quantityBase: 7 });
    await first.dispatch(op);

    await vi.waitFor(() =>
      expect(second.getState().ledger!.applied[op.id]).toBe(true),
    );
    const movement = second
      .getState()
      .ledger!.movements.find((row) => row.id === op.id);
    expect(movement?.quantityBase).toBe(7);
  });
});

describe('persistence', () => {
  it('falls back to memory where IndexedDB is missing', async () => {
    expect(typeof indexedDB).toBe('undefined');
    const persistence: Persistence = await openPersistence();
    expect(persistence.kind).toBe('memory');
  });
});
