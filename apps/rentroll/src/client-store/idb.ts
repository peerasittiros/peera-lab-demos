import type { Op } from './ops';
import type { Snapshot } from './schema';

/**
 * Browser persistence for the store (SPEC §2.2): the snapshot, the day it is for, and the visitor's ops in order.
 * When IndexedDB is missing, blocked, or the browser has under 5 MB free, the store runs in memory and says so.
 * Nothing here throws to the caller: a failed write is logged and the in-memory state carries on.
 */
export type Persistence = {
  memoryOnly: boolean;
  loadSnapshot(): Promise<Snapshot | null>;
  saveSnapshot(snapshot: Snapshot): Promise<void>;
  loadOps(): Promise<Op[]>;
  appendOp(op: Op): Promise<void>;
  clear(): Promise<void>;
};

const MIN_FREE_BYTES = 5 * 1024 * 1024;
const DB_NAME = 'rentroll';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshot';
const OPS_STORE = 'ops';
const SNAPSHOT_KEY = 'current';

export function memoryPersistence(memoryOnly = true): Persistence {
  let snapshot: Snapshot | null = null;
  let ops: Op[] = [];
  return {
    memoryOnly,
    async loadSnapshot() {
      return snapshot;
    },
    async saveSnapshot(next) {
      snapshot = next;
    },
    async loadOps() {
      return [...ops];
    },
    async appendOp(op) {
      ops = [...ops, op];
    },
    async clear() {
      snapshot = null;
      ops = [];
    },
  };
}

function logError(action: string, error: unknown) {
  console.error(`[rentroll] storage ${action} failed:`, error);
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function hasRoom(): Promise<boolean> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate?.quota) return true;
    return estimate.quota - (estimate.usage ?? 0) >= MIN_FREE_BYTES;
  } catch {
    return true;
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = () => {
        open.result.createObjectStore(SNAPSHOT_STORE);
        open.result.createObjectStore(OPS_STORE, { autoIncrement: true });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
      open.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** IndexedDB persistence, or the memory fallback when the browser can't or shouldn't store the demo. */
export async function openPersistence(): Promise<Persistence> {
  if (!(await hasRoom())) return memoryPersistence();
  const db = await openDatabase();
  if (!db) return memoryPersistence();

  return {
    memoryOnly: false,
    async loadSnapshot() {
      try {
        const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
        const value = await request(
          tx.objectStore(SNAPSHOT_STORE).get(SNAPSHOT_KEY),
        );
        return (value as Snapshot | undefined) ?? null;
      } catch (error) {
        logError('read snapshot', error);
        return null;
      }
    },
    async saveSnapshot(snapshot) {
      try {
        const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
        tx.objectStore(SNAPSHOT_STORE).put(snapshot, SNAPSHOT_KEY);
        await transactionDone(tx);
      } catch (error) {
        logError('write snapshot', error);
      }
    },
    async loadOps() {
      try {
        const tx = db.transaction(OPS_STORE, 'readonly');
        const ops = await request(tx.objectStore(OPS_STORE).getAll());
        return ops as Op[];
      } catch (error) {
        logError('read ops', error);
        return [];
      }
    },
    async appendOp(op) {
      try {
        const tx = db.transaction(OPS_STORE, 'readwrite');
        tx.objectStore(OPS_STORE).add(op);
        await transactionDone(tx);
      } catch (error) {
        logError('append op', error);
      }
    },
    async clear() {
      try {
        const tx = db.transaction([SNAPSHOT_STORE, OPS_STORE], 'readwrite');
        tx.objectStore(SNAPSHOT_STORE).clear();
        tx.objectStore(OPS_STORE).clear();
        await transactionDone(tx);
      } catch (error) {
        logError('clear', error);
      }
    },
  };
}
