import { timingSafeEqual } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import type { Db } from './client';
import { removeTenantData, type DemoAppConfig } from './demo-tenant';
import { demoSession } from './platform-schema';

export type DailyJob = { name: string; run: (db: Db) => Promise<unknown> };

/** Deletes the sandbox tenants (data + session) of sessions older than `olderThanHours`. Returns how many. */
export async function cleanupTenants(
  db: Db,
  config: DemoAppConfig,
  {
    olderThanHours = 24,
    now = new Date(),
  }: { olderThanHours?: number; now?: Date } = {},
): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanHours * 60 * 60 * 1000);
  const stale = await db
    .select({ id: demoSession.id, tenantId: demoSession.tenantId })
    .from(demoSession)
    .where(
      and(eq(demoSession.app, config.app), lt(demoSession.createdAt, cutoff)),
    );
  for (const session of stale) {
    await db.transaction(async (tx) => {
      await removeTenantData(tx, config, session.tenantId);
      await tx
        .delete(demoSession)
        .where(
          and(eq(demoSession.app, config.app), eq(demoSession.id, session.id)),
        );
    });
  }
  return stale.length;
}

function bearerMatches(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type DailyCronSummary = {
  ok: boolean;
  cleanup: { removed: number } | { error: string };
  jobs: { name: string; ok: boolean; error?: string }[];
};

/**
 * `GET /api/cron/daily` for an app (Spec corrections 7: one daily Vercel cron per app). Checks the
 * `Authorization: Bearer ${CRON_SECRET}` header Vercel sends, runs the tenant cleanup, then each app job in order.
 * A failing step is logged and reported; it doesn't stop the next one.
 */
export function createDailyCronRoute({
  config,
  getDb,
  secret,
  jobs = [],
}: {
  config: DemoAppConfig;
  getDb: () => Db;
  secret: string | (() => string | undefined);
  jobs?: DailyJob[];
}) {
  return async function GET(request: Request): Promise<Response> {
    const key = typeof secret === 'function' ? secret() : secret;
    if (!key)
      return Response.json(
        { error: 'CRON_SECRET is not set' },
        { status: 500 },
      );
    if (!bearerMatches(request.headers.get('authorization'), key)) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const summary: DailyCronSummary = {
      ok: true,
      cleanup: { removed: 0 },
      jobs: [],
    };
    try {
      summary.cleanup = { removed: await cleanupTenants(db, config) };
    } catch (error) {
      console.error(`[cron] ${config.app} cleanup failed`, error);
      summary.ok = false;
      summary.cleanup = { error: String(error) };
    }
    for (const job of jobs) {
      try {
        await job.run(db);
        summary.jobs.push({ name: job.name, ok: true });
      } catch (error) {
        console.error(`[cron] ${config.app} job ${job.name} failed`, error);
        summary.ok = false;
        summary.jobs.push({ name: job.name, ok: false, error: String(error) });
      }
    }
    return Response.json(summary, { status: summary.ok ? 200 : 500 });
  };
}
