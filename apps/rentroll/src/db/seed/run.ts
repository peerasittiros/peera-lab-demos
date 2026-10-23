import { openDb, platformMigrations, runMigrations } from '@peera/db';
import { rentrollMigrations } from '../migrations';
import { scriptEnv } from '../script-env';
import { buildSeed } from './generator';
import { insertSeed } from './insert';

/** Rewrites the apartment template tenant. Visitors keep their own sandboxes until they reset. */
async function run() {
  const { db, end } = openDb(scriptEnv.DATABASE_URL);
  try {
    await runMigrations(db, [platformMigrations, rentrollMigrations]);
    const data = buildSeed();
    await db.transaction((tx) => insertSeed(tx, data));
    console.log(
      `Rentroll seed: ${data.rooms.length} rooms, ${data.contracts.length} contracts, ${data.invoices.length} invoices`,
    );
  } finally {
    await end();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
