import {
  applyOp,
  replay,
  type ApplyOutcome,
  type Ledger,
  type Op,
} from './ops';
import { bangkokDay } from './relativize';
import type { Persistence } from './idb';
import type { Snapshot } from './snapshot';
import type { SyncChannel, SyncMessage } from './sync';

// The browser store: the snapshot plus the visitor's op log, rebuilt in memory. Views read `getState()` and
// subscribe; changes go through `dispatch(op)`, which persists the op, applies it and tells the other tabs.

export type StoreStatus = 'loading' | 'ready' | 'error';

export type StoreState = {
  status: StoreStatus;
  variant: string | null;
  snapshot: Snapshot | null;
  ledger: Ledger | null;
  /** Every op in the log, in order (for the change history of an item). */
  ops: Op[];
  /** Ops that could not be applied after a new-day refresh (their item is no longer in the snapshot). */
  skippedOps: number;
  persistence: Persistence['kind'] | null;
};

export type StoreDeps = {
  persistence: Persistence;
  fetchSnapshot: (variant: string) => Promise<Snapshot>;
  /** Injected so tests can move the clock; the app passes `() => new Date()`. */
  now: () => Date;
  /** Opens the tab-to-tab channel; `receive` runs for ops and resets posted by the other tabs. */
  openChannel: (
    onMessage: (message: SyncMessage) => void,
  ) => SyncChannel | null;
};

const initialState: StoreState = {
  status: 'loading',
  variant: null,
  snapshot: null,
  ledger: null,
  ops: [],
  skippedOps: 0,
  persistence: null,
};

export function createStore(deps: StoreDeps) {
  const { persistence, fetchSnapshot, now } = deps;
  let state: StoreState = { ...initialState, persistence: persistence.kind };
  const listeners = new Set<() => void>();
  const channel = deps.openChannel((message) => void onMessage(message));

  function set(next: Partial<StoreState>) {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  /**
   * Loads the shop for `variant`. Keeps the visitor's ops across a new day; drops everything when the variant
   * changes. A failed fetch falls back to the cached snapshot, and to `error` only when there is none.
   */
  async function load(variant: string) {
    set({ status: 'loading', variant });
    try {
      let meta = await persistence.readMeta();
      if (meta && meta.variant !== variant) {
        await persistence.clear();
        meta = undefined;
      }

      let snapshot = await persistence.readSnapshot();
      let fresh: Snapshot | null = null;
      const stale =
        !snapshot ||
        snapshot.snapshotDate !== bangkokDay(now()) ||
        snapshot.variant !== variant;
      if (stale) {
        try {
          fresh = await fetchSnapshot(variant);
          snapshot = fresh;
        } catch (error) {
          if (!snapshot) throw error;
          // Offline with yesterday's copy: keep working on it rather than failing the page.
        }
      }
      if (!snapshot) throw new Error('[stockline] no snapshot');

      const ops = await persistence.readOps();
      const { ledger, skipped } = replay(snapshot, ops);
      set({ status: 'ready', snapshot, ledger, ops, skippedOps: skipped });
      // The page shows the shop first; storing the new copy (a large structured clone) comes after.
      if (fresh) await keep(fresh, variant);
    } catch {
      set({ status: 'error' });
    }
  }

  /** Stores today's snapshot for the next visit. A failure (storage full or blocked) only means it is fetched again. */
  async function keep(snapshot: Snapshot, variant: string) {
    try {
      await persistence.writeSnapshot(snapshot);
      await persistence.writeMeta({
        variant,
        snapshotDate: snapshot.snapshotDate,
      });
    } catch {
      // Nothing to do: the shop is already on screen.
    }
  }

  function apply(op: Op): ApplyOutcome {
    if (!state.ledger) throw new Error('[stockline] the store is not loaded');
    const result = applyOp(state.ledger, op);
    if (result.outcome === 'applied')
      set({ ledger: result.ledger, ops: [...state.ops, op] });
    return result.outcome;
  }

  /** Records a visitor op: persisted first, then applied, then sent to the other tabs. */
  async function dispatch(op: Op): Promise<ApplyOutcome> {
    if (!state.ledger) throw new Error('[stockline] the store is not loaded');
    if (state.ledger.applied[op.id]) return 'duplicate';
    await persistence.writeOp(op);
    const outcome = apply(op);
    if (outcome === 'applied') channel?.post({ type: 'op', op });
    return outcome;
  }

  /** Clears the visitor's changes and the cached snapshot, then loads a fresh shop (DemoBar → Reset). */
  async function reset() {
    const variant = state.variant;
    await persistence.clear();
    channel?.post({ type: 'reset' });
    if (variant) await load(variant);
  }

  async function onMessage(message: SyncMessage) {
    if (message.type === 'reset') {
      if (state.variant) await load(state.variant);
      return;
    }
    if (!state.ledger || state.ledger.applied[message.op.id]) return;
    await persistence.writeOp(message.op);
    apply(message.op);
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load,
    dispatch,
    reset,
    /** Stops listening to the other tabs. Call it when the page goes away (and in tests). */
    close() {
      channel?.close();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
