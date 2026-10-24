'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { bootStore, getStore } from './instance';
import type { StoreState } from './store';

/**
 * `useStore(select)` reads the store with `useSyncExternalStore`. The selector runs once per store state, so it can
 * build new objects without looping. Prefer selectors defined at module level: an inline one reruns on every render.
 */
export function useStore<R>(select: (state: StoreState) => R): R {
  const store = getStore();
  const cache = useRef<{ state: StoreState; select: unknown; value: R } | null>(
    null,
  );
  const getSnapshot = () => {
    const state = store.getState();
    if (cache.current?.state === state && cache.current.select === select)
      return cache.current.value;
    const value = select(state);
    cache.current = { state, select, value };
    return value;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

const statusSelect = (state: StoreState) => ({
  status: state.status,
  memoryOnly: state.memoryOnly,
  snapshotDate: state.snapshotDate,
  note: state.note,
});

/** Where the store is: loading, ready or error; memory-only mode; and any note for the visitor. */
export function useStoreStatus() {
  return useStore(statusSelect);
}

/** Starts the store once on the client. Mount it at the top of any page that reads the store. */
export function useStoreBoot(): void {
  useEffect(() => {
    void bootStore();
  }, []);
}
