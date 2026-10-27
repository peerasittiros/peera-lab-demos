import type { Op } from './ops';
import type { Snapshot } from './snapshot';

// Where the visitor's state lives: IndexedDB when the browser allows it, else memory (private mode, the website's
// iframe with storage blocked). Both implement `Persistence`, so the store does not care which one it has.

export type Meta = {
  variant: string;
  role?: 'owner' | 'staff';
  snapshotDate: string;
};

export type Persistence = {
  /** `indexeddb` keeps changes across visits; `memory` only until this page closes. */
  readonly kind: 'indexeddb' | 'memory';
  readMeta(): Promise<Meta | undefined>;
  writeMeta(meta: Meta): Promise<void>;
  readSnapshot(): Promise<Snapshot | undefined>;
  writeSnapshot(snapshot: Snapshot): Promise<void>;
  /** Ops in the order they were recorded (by `at`, then id). */
  readOps(): Promise<Op[]>;
  /** Idempotent: writing the same op id twice keeps one row. */
  writeOp(op: Op): Promise<void>;
  clear(): Promise<void>;
};

export const DB_NAME = 'stockline';
/**
 * localStorage mirror of the stored snapshot, `<variant>:<role>:<YYYY-MM-DD>`. The head script (SnapshotPreload) reads it
 * synchronously, before IndexedDB can answer, to skip preloading a snapshot this browser already has for today.
 */
export const SNAPSHOT_HINT_KEY = 'stockline.snapshot';

function writeHint(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(SNAPSHOT_HINT_KEY);
    else localStorage.setItem(SNAPSHOT_HINT_KEY, value);
  } catch {
    // Storage blocked: the head script preloads every visit, which only costs a cached request.
  }
}
const DB_VERSION = 1;
const META = 'meta';
const SNAPSHOT = 'snapshot';
const OPS = 'ops';
const SINGLE_KEY = 'current';

function orderOps(ops: Op[]): Op[] {
  return [...ops].sort((a, b) =>
    a.at === b.at ? (a.id < b.id ? -1 : 1) : a.at < b.at ? -1 : 1,
  );
}

export function createMemoryPersistence(): Persistence {
  let meta: Meta | undefined;
  let snapshot: Snapshot | undefined;
  const ops = new Map<string, Op>();
  return {
    kind: 'memory',
    async readMeta() {
      return meta;
    },
    async writeMeta(next) {
      meta = next;
    },
    async readSnapshot() {
      return snapshot;
    },
    async writeSnapshot(next) {
      snapshot = next;
    },
    async readOps() {
      return orderOps([...ops.values()]);
    },
    async writeOp(op) {
      ops.set(op.id, op);
    },
    async clear() {
      meta = undefined;
      snapshot = undefined;
      ops.clear();
    },
  };
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
    tx.onabort = () =>
      reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(SNAPSHOT))
        db.createObjectStore(SNAPSHOT);
      if (!db.objectStoreNames.contains(OPS))
        db.createObjectStore(OPS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function createIndexedDbPersistence(db: IDBDatabase): Persistence {
  const store = (name: string, mode: IDBTransactionMode) =>
    db.transaction(name, mode).objectStore(name);
  return {
    kind: 'indexeddb',
    async readMeta() {
      return (await request(store(META, 'readonly').get(SINGLE_KEY))) as
        Meta | undefined;
    },
    async writeMeta(meta) {
      const tx = db.transaction(META, 'readwrite');
      tx.objectStore(META).put(meta, SINGLE_KEY);
      await transactionDone(tx);
      writeHint(`${meta.variant}:${meta.role ?? 'owner'}:${meta.snapshotDate}`);
    },
    async readSnapshot() {
      return (await request(store(SNAPSHOT, 'readonly').get(SINGLE_KEY))) as
        Snapshot | undefined;
    },
    async writeSnapshot(snapshot) {
      const tx = db.transaction(SNAPSHOT, 'readwrite');
      tx.objectStore(SNAPSHOT).put(snapshot, SINGLE_KEY);
      await transactionDone(tx);
    },
    async readOps() {
      const rows = (await request(store(OPS, 'readonly').getAll())) as Op[];
      return orderOps(rows);
    },
    async writeOp(op) {
      const tx = db.transaction(OPS, 'readwrite');
      tx.objectStore(OPS).put(op);
      await transactionDone(tx);
    },
    async clear() {
      const tx = db.transaction([META, SNAPSHOT, OPS], 'readwrite');
      tx.objectStore(META).clear();
      tx.objectStore(SNAPSHOT).clear();
      tx.objectStore(OPS).clear();
      await transactionDone(tx);
      writeHint(null);
    },
  };
}

/** IndexedDB if it opens, else memory. Never throws: a blocked store is a normal state for an embedded demo. */
export async function openPersistence(): Promise<Persistence> {
  if (typeof indexedDB === 'undefined') return createMemoryPersistence();
  try {
    return createIndexedDbPersistence(await openDatabase());
  } catch {
    return createMemoryPersistence();
  }
}

/** Deletes the whole database (Reset). Resolves even when the browser has no IndexedDB. */
export async function deleteDatabase(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
