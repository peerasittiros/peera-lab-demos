// Applies the platform migrations to DATABASE_URL: `corepack pnpm --filter @peera/db db:migrate`.
import { openDb } from '../src/client.ts';
import { platformMigrations, runMigrations } from '../src/migrate.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const { db, end } = openDb(url);
try {
  await runMigrations(db, [platformMigrations]);
  console.log('Platform migrations applied.');
} finally {
  await end();
}
