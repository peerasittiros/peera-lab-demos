'use client';

import type { QueuedReading } from '../../domain/meter-queue';

/**
 * The offline queue in IndexedDB (01 §6.4). Browser storage can be blocked or missing (private windows, old
 * browsers); then the queue lives in memory only, and the page says so through the online state. Nothing here throws.
 */
const DB_NAME = 'rentroll-meter-queue';
const STORE = 'readings';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readQueue(): Promise<QueuedReading[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => {
        db.close();
        resolve(request.result as QueuedReading[]);
      };
      request.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

/** Replaces the stored queue with `items`, in one transaction. */
export async function writeQueue(items: QueuedReading[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.clear();
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}
