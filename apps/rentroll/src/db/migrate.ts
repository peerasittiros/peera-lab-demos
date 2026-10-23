import { openDb, platformMigrations, runMigrations } from '@peera/db';
import { rentrollMigrations } from './migrations';
import { scriptEnv } from './script-env';

const { db, end } = openDb(scriptEnv.DATABASE_URL);

runMigrations(db, [platformMigrations, rentrollMigrations])
  .then(() => console.log('Rentroll migrations applied'))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => end());
