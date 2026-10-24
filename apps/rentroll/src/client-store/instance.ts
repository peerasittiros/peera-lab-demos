import { bangkokDate } from '@/src/domain/dates';
import { openPersistence } from './idb';
import type { Snapshot } from './schema';
import { createStore, type Store } from './store';
import { openSync } from './sync';

/**
 * The one store the browser uses. Created on first use; `start()` runs once from `useStoreBoot()` in the client, never
 * on the server (there it stays empty and the views show their loading state).
 */
async function fetchSnapshot(): Promise<Snapshot> {
  const response = await fetch('/api/demo/snapshot');
  if (!response.ok)
    throw new Error(`snapshot request failed: ${response.status}`);
  const snapshot = (await response.json()) as Snapshot;
  if (snapshot.schemaVersion !== 1)
    throw new Error(`unknown snapshot version ${snapshot.schemaVersion}`);
  return snapshot;
}

let instance: Store | null = null;

export function getStore(): Store {
  instance ??= createStore({
    openPersistence,
    fetchSnapshot,
    openSync,
    today: () => bangkokDate(new Date()),
  });
  return instance;
}

let booted: Promise<void> | null = null;

/** Loads the store once per page. Later calls return the same promise. */
export function bootStore(): Promise<void> {
  booted ??= getStore().start();
  return booted;
}
