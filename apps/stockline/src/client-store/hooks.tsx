'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { openPersistence } from './idb';
import { createStore, type Store, type StoreState } from './store';
import type { Snapshot } from './snapshot';
import { openSyncChannel } from './sync';
import { VARIANT_KEY, VARIANTS } from './variant';
import { categoryViews, itemViews, supplierViews, unitViews } from './views';
import type { Role } from '../domain/stock';

// React access to the browser store. `StoreProvider` opens the store once per page and loads the shop for the
// variant; components read it with the hooks below.

const StoreContext = createContext<Store | null>(null);

const EMPTY_STATE: StoreState = {
  status: 'loading',
  variant: null,
  snapshot: null,
  ledger: null,
  ops: [],
  skippedOps: 0,
  persistence: null,
};

async function fetchSnapshot(variant: string): Promise<Snapshot> {
  const response = await fetch(
    `/api/demo/snapshot?variant=${encodeURIComponent(variant)}`,
  );
  if (!response.ok) throw new Error(`snapshot ${response.status}`);
  return (await response.json()) as Snapshot;
}

/**
 * The shop for this browser: `?variant=` when the link names one (and it is remembered), else the last one, else the
 * minimart. Read in the browser, so a visit writes nothing on the server.
 */
function chooseVariant(): string {
  const fromLink = new URLSearchParams(window.location.search).get('variant');
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(VARIANT_KEY);
  } catch {
    stored = null;
  }
  const chosen = [fromLink, stored].find((value): value is string => value !== null && VARIANTS.includes(value));
  const variant = chosen ?? 'minimart';
  try {
    localStorage.setItem(VARIANT_KEY, variant);
  } catch {
    // Storage blocked: the shop is the default one on the next visit.
  }
  return variant;
}

// Opening IndexedDB starts when this module runs in the browser, not in the provider's effect: the effect runs only
// after hydration, about half a second later on a phone, and the store waits on it before it can show anything.
let persistenceReady =
  typeof window === 'undefined' ? null : openPersistence();

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);

  useEffect(() => {
    let closed = false;
    let created: Store | null = null;
    persistenceReady ??= openPersistence();
    void persistenceReady.then((persistence) => {
      if (closed) return;
      created = createStore({
        persistence,
        fetchSnapshot,
        now: () => new Date(),
        openChannel: (onMessage) => openSyncChannel(onMessage),
      });
      setStore(created);
      void created.load(chooseVariant());
    });
    return () => {
      closed = true;
      created?.close();
    };
  }, []);

  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}

/** The store itself (commands and reset), or null until the page has opened it. */
export function useStoreInstance(): Store | null {
  return useContext(StoreContext);
}

/** The store's state; re-renders when it changes. */
export function useStoreState(): StoreState {
  const store = useStoreInstance();
  return useSyncExternalStore(
    (listener) => store?.subscribe(listener) ?? (() => {}),
    () => store?.getState() ?? EMPTY_STATE,
    () => EMPTY_STATE,
  );
}

/** Active items with balance and status, for one role. Empty until the store is loaded. */
export function useItemViews(
  role: Role,
  options?: { includeInactive?: boolean },
) {
  const { ledger } = useStoreState();
  const includeInactive = options?.includeInactive ?? false;
  return useMemo(
    () => (ledger ? itemViews(ledger, role, { includeInactive }) : []),
    [ledger, role, includeInactive],
  );
}

/** Units, categories and suppliers for the item form. `loaded` is false until the store has the shop. */
export function useItemFormOptions() {
  const { ledger } = useStoreState();
  return useMemo(
    () => ({
      loaded: Boolean(ledger),
      units: ledger ? unitViews(ledger) : [],
      categories: ledger ? categoryViews(ledger) : [],
      suppliers: ledger ? supplierViews(ledger) : [],
    }),
    [ledger],
  );
}
