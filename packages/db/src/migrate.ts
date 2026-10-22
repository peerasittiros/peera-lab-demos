import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import type { Db } from './client';

export type MigrationSet = {
  /** Short name; each set keeps its own journal table (`drizzle.__migrations_<name>`), so sets never collide. */
  name: string;
  /** Folder written by `drizzle-kit generate`. */
  folder: string;
};

/** The platform tables' migrations. Apps run this set first, then their own. */
export const platformMigrations: MigrationSet = {
  name: 'platform',
  folder: fileURLToPath(new URL('../drizzle', import.meta.url)),
};

export async function runMigrations(
  db: Db,
  sets: MigrationSet[],
): Promise<void> {
  for (const set of sets) {
    await migrate(db, {
      migrationsFolder: set.folder,
      migrationsSchema: 'drizzle',
      migrationsTable: `__migrations_${set.name}`,
    });
  }
}
