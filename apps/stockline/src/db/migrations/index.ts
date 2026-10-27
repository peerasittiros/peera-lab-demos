import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MigrationSet } from '@peera/db';

export const stocklineMigrations: MigrationSet = {
  name: 'stockline',
  folder: dirname(fileURLToPath(import.meta.url)),
};
