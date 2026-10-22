import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertRowCap } from './action';
import {
  fixtureConfig as config,
  fixtureItem as item,
  setupCloneFixture,
} from './clone-fixture';
import { cleanupTenants, createDailyCronRoute } from './cron';
import { getDemoTenant } from './demo-tenant';
import { demoSession, event } from './platform-schema';
import { createTestDb, type TestDb } from './testing';

const SECRET = 'cron-secret-for-tests';
let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  await setupCloneFixture(testDb.db);
});

afterAll(async () => {
  await testDb?.cleanup();
});

async function sessionAged(hours: number) {
  const sid = crypto.randomUUID();
  const { tenantId } = await getDemoTenant(testDb.db, config, { sid });
  await testDb.db
    .update(demoSession)
    .set({ createdAt: sql`now() - make_interval(hours => ${hours})` })
    .where(eq(demoSession.id, sid));
  await testDb.db.insert(event).values({ tenantId, kind: 'test' });
  return { sid, tenantId };
}

const rowsOf = (tenantId: string) =>
  testDb.db.select().from(item).where(eq(item.tenantId, tenantId));

describe('cleanupTenants', () => {
  it('deletes only tenants older than 24 hours, with their events', async () => {
    const old = await sessionAged(25);
    const fresh = await sessionAged(23);

    expect(await cleanupTenants(testDb.db, config)).toBe(1);

    expect(await rowsOf(old.tenantId)).toEqual([]);
    expect(
      await testDb.db
        .select()
        .from(event)
        .where(eq(event.tenantId, old.tenantId)),
    ).toEqual([]);
    expect(
      await testDb.db
        .select()
        .from(demoSession)
        .where(eq(demoSession.id, old.sid)),
    ).toEqual([]);
    expect(await rowsOf(fresh.tenantId)).toHaveLength(2);
    // The template tenant is never a session, so it survives.
    expect(await rowsOf(config.templates.minimart!)).toHaveLength(2);
  });
});

describe('createDailyCronRoute', () => {
  const request = (authorization?: string) =>
    new Request('https://demo.test/api/cron/daily', {
      headers: authorization ? { authorization } : {},
    });

  it('rejects a missing or wrong bearer token', async () => {
    const GET = createDailyCronRoute({
      config,
      getDb: () => testDb.db,
      secret: SECRET,
    });
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request('Bearer nope'))).status).toBe(401);
  });

  it('runs cleanup, then every job in order, even when one throws', async () => {
    const old = await sessionAged(30);
    const order: string[] = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const GET = createDailyCronRoute({
      config,
      getDb: () => testDb.db,
      secret: () => SECRET,
      jobs: [
        {
          name: 'first',
          run: async () => {
            order.push(`first:${(await rowsOf(old.tenantId)).length}`);
            throw new Error('boom');
          },
        },
        { name: 'second', run: async () => void order.push('second') },
      ],
    });

    const response = await GET(request(`Bearer ${SECRET}`));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      cleanup: { removed: 1 },
      jobs: [
        { name: 'first', ok: false, error: 'Error: boom' },
        { name: 'second', ok: true },
      ],
    });
    // Cleanup ran before the first job saw the tenant.
    expect(order).toEqual(['first:0', 'second']);
  });
});

describe('assertRowCap', () => {
  it('blocks at the cap', async () => {
    const { tenantId } = await getDemoTenant(testDb.db, config, {
      sid: crypto.randomUUID(),
    });
    await expect(
      assertRowCap(testDb.db, item, tenantId, 3),
    ).resolves.toBeUndefined();
    await expect(
      assertRowCap(testDb.db, item, tenantId, 2),
    ).rejects.toMatchObject({
      code: 'row_cap',
      messageKey: 'errors.rowCap',
    });
  });
});
