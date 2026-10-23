import type { MigrationSet } from '@peera/db';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Rentroll's own migrations (schema `rentroll`). Run after the platform set. */
export const rentrollMigrations: MigrationSet = {
  name: 'rentroll',
  folder: join(dirname(fileURLToPath(import.meta.url))),
};
