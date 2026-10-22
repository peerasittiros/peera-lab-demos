import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  fixtureConfig as config,
  fixtureItem as item,
  setupCloneFixture,
} from './clone-fixture';
import { getDemoTenant, resetDemoTenant, setSessionRole } from './demo-tenant';
import { demoSession, event } from './platform-schema';
import { createTestDb, type TestDb } from './testing';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  await setupCloneFixture(testDb.db);
});

afterAll(async () => {
  await testDb?.cleanup();
});

const bangkokDate = (date: Date) =>
  date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const bangkokTime = (date: Date) =>
  date.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  });
const daysBefore = (days: number) =>
  bangkokDate(new Date(Date.now() - days * 86_400_000));

describe('getDemoTenant', () => {
  it('creates exactly one tenant for ten parallel first requests', async () => {
    const sid = crypto.randomUUID();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        getDemoTenant(testDb.db, config, { sid, locale: 'en' }),
      ),
    );
    const tenantIds = new Set(results.map((result) => result.tenantId));
    expect(tenantIds.size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);

    const [tenantId] = [...tenantIds];
    const sessions = await testDb.db
      .select()
      .from(demoSession)
      .where(eq(demoSession.id, sid));
    expect(sessions).toHaveLength(1);
    const rows = await testDb.db
      .select()
      .from(item)
      .where(eq(item.tenantId, tenantId!));
    expect(rows).toHaveLength(2);
  });

  it('copies the template with new ids, remapped parents and dates relative to today', async () => {
    const { tenantId } = await getDemoTenant(testDb.db, config, {
      sid: crypto.randomUUID(),
    });
    const rows = await testDb.db
      .select()
      .from(item)
      .where(eq(item.tenantId, tenantId));
    const parent = rows.find((row) => row.name === 'Drinks')!;
    const child = rows.find((row) => row.name === 'Water 600 ml')!;

    expect(parent.id).not.toBe('10000000-0000-4000-8000-000000000001');
    expect(child.parentId).toBe(parent.id);
    expect(bangkokDate(parent.occurredAt!)).toBe(daysBefore(0));
    expect(bangkokTime(parent.occurredAt!)).toBe('00:30');
    expect(bangkokDate(child.occurredAt!)).toBe(daysBefore(3));
    expect(bangkokTime(child.occurredAt!)).toBe('01:30');
  });

  it('falls back to the default variant and keeps the session role', async () => {
    const sid = crypto.randomUUID();
    const first = await getDemoTenant(testDb.db, config, {
      sid,
      variant: 'unknown',
    });
    expect(first.variant).toBe('minimart');
    await setSessionRole(testDb.db, config, { sid, role: 'staff' });
    const again = await getDemoTenant(testDb.db, config, { sid });
    expect(again).toMatchObject({
      tenantId: first.tenantId,
      role: 'staff',
      created: false,
    });
  });
});

describe('resetDemoTenant', () => {
  it("replaces the visitor's changes with a fresh copy under the same tenant id", async () => {
    const sid = crypto.randomUUID();
    const { tenantId } = await getDemoTenant(testDb.db, config, { sid });
    await testDb.db
      .update(item)
      .set({ name: 'Edited by visitor' })
      .where(and(eq(item.tenantId, tenantId), eq(item.name, 'Drinks')));
    await testDb.db.insert(event).values({ tenantId, kind: 'test' });
    const before = await testDb.db
      .select()
      .from(item)
      .where(eq(item.tenantId, tenantId));

    expect(await resetDemoTenant(testDb.db, config, { sid })).toBe(tenantId);

    const after = await testDb.db
      .select()
      .from(item)
      .where(eq(item.tenantId, tenantId));
    expect(after.map((row) => row.name).sort()).toEqual([
      'Drinks',
      'Water 600 ml',
    ]);
    expect(after.some((row) => before.some((old) => old.id === row.id))).toBe(
      false,
    );
    expect(
      await testDb.db.select().from(event).where(eq(event.tenantId, tenantId)),
    ).toEqual([]);
  });
});
