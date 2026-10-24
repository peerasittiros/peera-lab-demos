import { canApply, apply, type Op } from './ops';
import type { Persistence } from './idb';
import type { Data, Snapshot, TableName } from './schema';
import type { Sync } from './sync';

/**
 * The browser store (SPEC §2.2): the daily snapshot plus the visitor's ops, replayed into memory. Views read it through
 * selectors and change it through commands, which dispatch ops. Nothing else mutates the data.
 */

export type StoreStatus = 'loading' | 'ready' | 'error';

/** A note for the UI: the data was refreshed for a new day, or the old copy is in use because the refresh failed. */
export type StoreNote =
  { kind: 'refreshed'; skippedOps: number } | { kind: 'stale' } | null;

export type StoreState = {
  status: StoreStatus;
  memoryOnly: boolean;
  snapshotDate: string | null;
  data: Data;
  ops: Op[];
  note: StoreNote;
};

export type StoreDeps = {
  openPersistence: () => Promise<Persistence>;
  fetchSnapshot: () => Promise<Snapshot>;
  openSync: (onRemoteOp: (op: Op) => void) => Sync | null;
  /** The Bangkok calendar date (YYYY-MM-DD) of "now". */
  today: () => string;
};

export type Store = {
  getState(): StoreState;
  subscribe(listener: () => void): () => void;
  /** Loads the snapshot and replays the stored ops. Safe to call again (a new day, or after a reset). */
  start(): Promise<void>;
  /** Applies a visitor op, stores it and tells other tabs. False when the op is a duplicate or no longer fits. */
  dispatch(op: Op): boolean;
  /** Deletes the stored snapshot and ops, then loads a fresh copy. */
  reset(): Promise<void>;
  /** Stops listening to other tabs. */
  close(): void;
};

export const TABLE_NAMES = [
  'building',
  'rate_plan',
  'room_type',
  'room',
  'renter',
  'contract',
  'contract_renter',
  'meter_reading',
  'invoice',
  'invoice_line',
  'payment',
  'payment_allocation',
  'credit_note',
  'checklist',
  'settlement',
  'repair_ticket',
  'ticket_message',
  'announcement',
  'doc_sequence',
] as const satisfies readonly TableName[];

export function emptyData(): Data {
  return Object.fromEntries(
    TABLE_NAMES.map((name) => [name, []]),
  ) as unknown as Data;
}

/** The snapshot's rows as the store's data. Tables missing from the document start empty. */
export function fromSnapshot(snapshot: Snapshot): Data {
  const data = emptyData() as Record<TableName, unknown[]>;
  for (const name of TABLE_NAMES) {
    data[name] = [...(snapshot.tables[name] ?? [])];
  }
  return data as unknown as Data;
}

/**
 * Replays ops over `base`. An op with an id already seen is ignored (idempotent), and an op that no longer fits the
 * data is skipped and counted, so a refreshed snapshot can't break the visitor's earlier changes.
 */
export function replay(
  base: Data,
  ops: Op[],
): { data: Data; seen: Set<string>; skipped: number } {
  let data = base;
  const seen = new Set<string>();
  let skipped = 0;
  for (const op of ops) {
    if (seen.has(op.id)) continue;
    seen.add(op.id);
    if (canApply(data, op)) data = apply(data, op);
    else skipped += 1;
  }
  return { data, seen, skipped };
}

export function createStore(deps: StoreDeps): Store {
  let state: StoreState = {
    status: 'loading',
    memoryOnly: false,
    snapshotDate: null,
    data: emptyData(),
    ops: [],
    note: null,
  };
  let persistence: Persistence | null = null;
  let seen = new Set<string>();
  let sync: Sync | null = null;
  const listeners = new Set<() => void>();

  const update = (patch: Partial<StoreState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  /** Applies an op to memory if it fits. Returns whether it did. */
  const receive = (op: Op): boolean => {
    if (seen.has(op.id) || !canApply(state.data, op)) return false;
    seen = new Set(seen).add(op.id);
    update({ data: apply(state.data, op), ops: [...state.ops, op] });
    return true;
  };

  const store: Store = {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async start() {
      update({ status: 'loading', note: null });
      persistence ??= await deps.openPersistence();
      update({ memoryOnly: persistence.memoryOnly });

      const cached = await persistence.loadSnapshot();
      const storedOps = await persistence.loadOps();
      const today = deps.today();

      let snapshot = cached;
      let note: StoreNote = null;
      if (!cached || cached.snapshotDate !== today) {
        try {
          const fresh = await deps.fetchSnapshot();
          await persistence.saveSnapshot(fresh);
          snapshot = fresh;
        } catch (error) {
          console.error('[rentroll] snapshot fetch failed:', error);
          if (!cached) {
            update({ status: 'error' });
            return;
          }
          note = { kind: 'stale' };
        }
      }

      const result = replay(fromSnapshot(snapshot!), storedOps);
      seen = result.seen;
      if (cached && snapshot !== cached)
        note = { kind: 'refreshed', skippedOps: result.skipped };

      sync?.close();
      sync = deps.openSync(receive);
      update({
        status: 'ready',
        snapshotDate: snapshot!.snapshotDate,
        data: result.data,
        ops: storedOps,
        note,
      });
    },

    dispatch(op) {
      if (state.status !== 'ready' || !receive(op)) return false;
      persistence?.appendOp(op).catch(() => undefined);
      sync?.post(op);
      return true;
    },

    async reset() {
      await persistence?.clear();
      seen = new Set();
      store.close();
      await store.start();
    },

    close() {
      sync?.close();
      sync = null;
    },
  };

  return store;
}
