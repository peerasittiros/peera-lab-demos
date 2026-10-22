import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { openDb, type Db } from './client';
import {
  platformMigrations,
  runMigrations,
  type MigrationSet,
} from './migrate';

const envFile = fileURLToPath(
  new URL('../../../.env.test.local', import.meta.url),
);

/** DATABASE_URL from the environment, else from the repo's `.env.test.local`. Throws if neither has it. */
export function testDatabaseUrl(): string {
  if (!process.env.DATABASE_URL && existsSync(envFile))
    process.loadEnvFile(envFile);
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Start the local Postgres (docker start peera-pg) and put ' +
        'DATABASE_URL=postgres://postgres:dev@localhost:5432/demos in peera-lab-demos/.env.test.local.',
    );
  }
  return url;
}

export type TestDb = {
  db: Db;
  /** Connection string of the throwaway database. */
  url: string;
  /** Closes the pool and drops the database. Call it in `afterAll`. */
  cleanup: () => Promise<void>;
};

/**
 * A throwaway database for one test file: created empty, migrated (platform first, then `migrations`), dropped by
 * `cleanup`. A whole database rather than a schema per file, because the platform and app tables live in fixed,
 * named schemas (`platform`, `stockline`, …).
 */
export async function createTestDb(
  migrations: MigrationSet[] = [],
): Promise<TestDb> {
  const adminUrl = testDatabaseUrl();
  const name = `peera_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`create database ${name}`);
  } finally {
    await admin.end();
  }

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const handle = openDb(url.toString());
  await runMigrations(handle.db, [platformMigrations, ...migrations]);

  return {
    db: handle.db,
    url: url.toString(),
    cleanup: async () => {
      await handle.end();
      const client = new pg.Client({ connectionString: adminUrl });
      await client.connect();
      try {
        await client.query(`drop database if exists ${name} with (force)`);
      } finally {
        await client.end();
      }
    },
  };
}
