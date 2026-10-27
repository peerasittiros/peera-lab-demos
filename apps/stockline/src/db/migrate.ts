import { openDb, platformMigrations, runMigrations } from '@peera/db';
import { stocklineMigrations } from './migrations';
import { scriptEnv } from './script-env';

const { db, end } = openDb(scriptEnv.DATABASE_URL);

runMigrations(db, [platformMigrations, stocklineMigrations])
  .then(() => console.log('Stockline migrations applied'))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => end());
