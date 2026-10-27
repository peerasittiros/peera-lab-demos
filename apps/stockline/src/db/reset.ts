import { openDb } from '@peera/db';
import { demoSession } from '@peera/db/schema';
import { eq, sql } from 'drizzle-orm';
import { demoApp } from './demo-app';
import { scriptEnv } from './script-env';
import { buildSeedVariant, STOCKLINE_VARIANTS } from './seed/generator';
import { insertSeed } from './seed/insert';

/**
 * Local reset: removes every Stockline visitor tenant and session, then rewrites the templates. Never point it
 * at production: visitors would lose their sandboxes (they get a fresh one on the next request).
 */
async function reset() {
  const { db, end } = openDb(scriptEnv.DATABASE_URL);
  try {
    const sessions = await db
      .select({ tenantId: demoSession.tenantId })
      .from(demoSession)
      .where(eq(demoSession.app, demoApp.app));
    await db.transaction(async (tx) => {
      for (const session of sessions)
        await tx.execute(
          sql`select stockline.delete_demo_tenant(${session.tenantId}::uuid)`,
        );
      await tx.delete(demoSession).where(eq(demoSession.app, demoApp.app));
      for (const variant of STOCKLINE_VARIANTS)
        await insertSeed(tx, buildSeedVariant(variant));
    });
    console.log(
      `Stockline reset: ${sessions.length} visitor tenants removed, templates rewritten`,
    );
  } finally {
    await end();
  }
}

reset().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
