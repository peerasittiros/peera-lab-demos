import { describe, expect, it } from 'vitest';
import { memoryPersistence } from './idb';
import type { Op } from './ops';
import type { Snapshot } from './schema';
import { createStore, type Store } from './store';
import { openSync } from './sync';
import { snapshotFor } from './testing';

const TODAY = '2026-10-24';
const TOMORROW = '2026-10-25';
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

type Persistence = ReturnType<typeof memoryPersistence>;

function makeStore(opts: {
  persistence?: Persistence;
  snapshot?: () => Promise<Snapshot>;
  today?: string;
  sync?: boolean;
}): { store: Store; persistence: Persistence } {
  const persistence = opts.persistence ?? memoryPersistence();
  const store = createStore({
    openPersistence: async () => persistence,
    fetchSnapshot:
      opts.snapshot ?? (async () => snapshotFor(opts.today ?? TODAY)),
    openSync: opts.sync ? openSync : () => null,
    today: () => opts.today ?? TODAY,
  });
  return { store, persistence };
}

/** A tenant's slip against the first sent invoice, for `id`. */
function slipOp(store: Store, id: string): Op {
  const invoice = store
    .getState()
    .data.invoice.find((i) => i.status === 'sent')!;
  return {
    id,
    at: `${TODAY}T10:00:00.000Z`,
    role: 'tenant',
    kind: 'slip.submit',
    payload: {
      paymentId: `pay-${id}`,
      contractId: invoice.contractId,
      amountSatang: 100,
      slipUrl: null,
      paidAt: `${TODAY}T10:00:00.000Z`,
    },
  };
}

describe('createStore', () => {
  it('loads the snapshot, reports ready and keeps the snapshot for the day', async () => {
    const { store, persistence } = makeStore({});
    await store.start();
    expect(store.getState()).toMatchObject({
      status: 'ready',
      snapshotDate: TODAY,
      memoryOnly: true,
      note: null,
    });
    expect(store.getState().data.room.length).toBeGreaterThan(0);
    expect(await persistence.loadSnapshot()).toMatchObject({
      snapshotDate: TODAY,
    });
  });

  it('dispatch applies and stores the op, and refuses a duplicate', async () => {
    const { store, persistence } = makeStore({});
    await store.start();
    const op = slipOp(store, 'op-a');
    expect(store.dispatch(op)).toBe(true);
    expect(store.dispatch(op)).toBe(false);
    expect(store.getState().data.payment.some((p) => p.id === 'pay-op-a')).toBe(
      true,
    );
    await settle();
    expect(await persistence.loadOps()).toEqual([op]);
  });

  it('restores stored ops on the next start', async () => {
    const { store, persistence } = makeStore({});
    await store.start();
    store.dispatch(slipOp(store, 'op-b'));
    await settle();

    const again = makeStore({ persistence }).store;
    await again.start();
    expect(again.getState().data.payment.some((p) => p.id === 'pay-op-b')).toBe(
      true,
    );
  });

  it('keeps the visitor ops and notes the refresh on a new day', async () => {
    const { store, persistence } = makeStore({});
    await store.start();
    store.dispatch(slipOp(store, 'op-c'));
    await settle();

    const nextDay = makeStore({ persistence, today: TOMORROW }).store;
    await nextDay.start();
    expect(nextDay.getState()).toMatchObject({
      snapshotDate: TOMORROW,
      note: { kind: 'refreshed', skippedOps: 0 },
    });
    expect(
      nextDay.getState().data.payment.some((p) => p.id === 'pay-op-c'),
    ).toBe(true);
  });

  it('counts ops whose rows vanished in a refreshed snapshot', async () => {
    const { store, persistence } = makeStore({});
    await store.start();
    store.dispatch(slipOp(store, 'op-d'));
    await settle();

    const shrunk = snapshotFor(TOMORROW);
    shrunk.tables.contract = [];
    const nextDay = makeStore({
      persistence,
      snapshot: async () => shrunk,
      today: TOMORROW,
    }).store;
    await nextDay.start();
    expect(nextDay.getState().note).toEqual({
      kind: 'refreshed',
      skippedOps: 1,
    });
  });

  it('uses the cached copy when the refresh fails, with a stale note', async () => {
    const { store, persistence } = makeStore({});
    await store.start();
    const offline = makeStore({
      persistence,
      today: TOMORROW,
      snapshot: async () => {
        throw new Error('offline');
      },
    }).store;
    await offline.start();
    expect(offline.getState()).toMatchObject({
      status: 'ready',
      snapshotDate: TODAY,
      note: { kind: 'stale' },
    });
  });

  it('is in error with nothing cached and no network', async () => {
    const { store } = makeStore({
      snapshot: async () => {
        throw new Error('offline');
      },
    });
    await store.start();
    expect(store.getState().status).toBe('error');
  });

  it('reset clears the stored snapshot and ops', async () => {
    const { store, persistence } = makeStore({});
    await store.start();
    store.dispatch(slipOp(store, 'op-e'));
    await settle();
    await store.reset();
    expect(store.getState().data.payment.some((p) => p.id === 'pay-op-e')).toBe(
      false,
    );
    expect(store.getState().ops).toEqual([]);
    expect(await persistence.loadOps()).toEqual([]);
  });

  it('shares an op with a second tab through BroadcastChannel', async () => {
    const tabA = makeStore({ sync: true }).store;
    const tabB = makeStore({ sync: true }).store;
    await tabA.start();
    await tabB.start();
    const op = slipOp(tabA, 'op-f');
    tabA.dispatch(op);
    await settle();
    expect(tabB.getState().data.payment.some((p) => p.id === 'pay-op-f')).toBe(
      true,
    );
    expect(tabB.getState().ops).toEqual([op]);
    tabA.close();
    tabB.close();
  });
});
