import { openDb, platformMigrations, runMigrations } from '@peera/db';
import { stocklineMigrations } from '../migrations';
import { scriptEnv } from '../script-env';
import { buildSeedVariant, STOCKLINE_VARIANTS } from './generator';
import { insertSeed } from './insert';

/** Migrates, then (re)writes the three template tenants. Visitors' tenants are left alone. */
async function seed() {
  const { db, end } = openDb(scriptEnv.DATABASE_URL);
  try {
    await runMigrations(db, [platformMigrations, stocklineMigrations]);
    for (const variant of STOCKLINE_VARIANTS) {
      const data = buildSeedVariant(variant);
      await db.transaction((tx) => insertSeed(tx, data));
      console.log(
        `Seeded ${variant}: ${data.items.length} items, ${data.movements.length} movements, ` +
          `${data.orders.length} purchase orders`,
      );
    }
  } finally {
    await end();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
