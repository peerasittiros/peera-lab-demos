import { Pool as NeonPool } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import {
  drizzle as drizzlePg,
  type NodePgDatabase,
} from 'drizzle-orm/node-postgres';
import pg from 'pg';

/**
 * The database handle every package and app uses. Both drivers expose the same Drizzle query and transaction API;
 * the type is node-postgres's, and the Neon handle is cast to it (see createDb).
 */
export type Db = NodePgDatabase;

/** A transaction handle, as passed to `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Anything that can run queries: the root handle or a transaction. */
export type Queryable = Db | Tx;

export type DbHandle = { db: Db; end: () => Promise<void> };

/**
 * Neon hosts use the Neon serverless driver (WebSocket pool, works in Vercel functions); everything else, such as
 * the local Docker Postgres, uses node-postgres. Tables are schema-qualified (`pgSchema`), so no search_path is set:
 * Neon's pooled endpoint does not accept a startup `options` parameter.
 */
export function isNeonUrl(url: string): boolean {
  return new URL(url).hostname.endsWith('.neon.tech');
}

export function openDb(url: string): DbHandle {
  if (isNeonUrl(url)) {
    const pool = new NeonPool({ connectionString: url });
    return {
      db: drizzleNeon({ client: pool }) as unknown as Db,
      end: () => pool.end(),
    };
  }
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return { db: drizzlePg({ client: pool }), end: () => pool.end() };
}

const globalPools = globalThis as typeof globalThis & {
  __peeraDb?: Map<string, DbHandle>;
};

/** One pool per URL per server process (survives Next dev reloads). Use `openDb` when you need to close it. */
export function createDb({ url }: { url: string }): Db {
  globalPools.__peeraDb ??= new Map();
  let handle = globalPools.__peeraDb.get(url);
  if (!handle) {
    handle = openDb(url);
    globalPools.__peeraDb.set(url, handle);
  }
  return handle.db;
}
