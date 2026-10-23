import { event, getDemoTenant, withTenant } from '@peera/db';
import { createTestDb, type TestDb } from '@peera/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoApp } from './demo-app';
import { rentrollMigrations } from './migrations';
import { loadAnnouncements, loadBills, loadOwnerFeed, loadRepairs, loadTenantHome, tenantContract } from './queries/tenant';
import { loadProperty } from './queries/property';
import { buildSeed } from './seed/generator';
import { insertSeed } from './seed/insert';
import { createRepairTicket, postAnnouncement } from './writes/tenant';
import { bangkokDate } from '../domain/dates';

let testDb: TestDb;
let tenantId: string;
let buildingId: string;
const today = () => bangkokDate(new Date());

beforeAll(async () => {
  testDb = await createTestDb([rentrollMigrations]);
  const data = buildSeed();
  await testDb.db.transaction((tx) => insertSeed(tx, data));
  ({ tenantId } = await getDemoTenant(testDb.db, demoApp, { sid: crypto.randomUUID(), variant: 'apartment' }));
  buildingId = (await loadProperty(testDb.db, tenantId, today())).buildings[0]!.id;
});

afterAll(async () => {
  await testDb?.cleanup();
});

describe('tenant portal', () => {
  it('shows room A-305, with its balance and the next bill to pay', async () => {
    const current = await tenantContract(testDb.db, tenantId, today());
    expect(current?.roomNumber).toBe('A-305');
    const home = await loadTenantHome(testDb.db, tenantId, today());
    expect(home!.roomNumber).toBe('A-305');
    expect(home!.balanceSatang).toBeGreaterThan(0);
    expect(home!.nextInvoice).not.toBeNull();
  });

  it('lists at most twelve bills and twelve months of usage, oldest usage first', async () => {
    const current = (await tenantContract(testDb.db, tenantId, today()))!;
    const data = await loadBills(testDb.db, tenantId, current.contractId, current.roomId);
    expect(data.bills.length).toBeLessThanOrEqual(12);
    expect(data.usage.length).toBeLessThanOrEqual(12);
    const periods = data.usage.map((u) => u.period);
    expect([...periods].sort()).toEqual(periods);
  });
});

describe('repairs and announcements', () => {
  it('a repair request starts as new, is shown to the tenant, and reaches the owner feed', async () => {
    const current = (await tenantContract(testDb.db, tenantId, today()))!;
    const { ticketId } = await testDb.db.transaction((tx) =>
      createRepairTicket(tx, tenantId, {
        roomId: current.roomId,
        renterId: current.renterId,
        category: 'aircon',
        description: 'แอร์ไม่เย็น',
        preferredTime: 'evening',
        allowEntry: true,
      }),
    );
    const tickets = await loadRepairs(testDb.db, tenantId, current.roomId);
    const ticket = tickets.find((t) => t.id === ticketId)!;
    expect(ticket.status).toBe('new');
    expect(ticket.allowEntry).toBe(true);
    expect(ticket.messages.map((m) => m.authorRole)).toEqual(['tenant']);

    const feed = await loadOwnerFeed(testDb.db, tenantId);
    expect(feed.openRepairs).toBeGreaterThan(0);
    expect(feed.events.some((e) => e.kind === 'repair.created' && (e.payload as { ticketId?: string }).ticketId === ticketId)).toBe(true);
  });

  it('a posted announcement shows on the tenant home, and records an event for the live side', async () => {
    const before = (await testDb.db.execute<{ n: number }>(sql`select count(*)::int as n from platform.event where tenant_id = ${tenantId}::uuid`)).rows[0]!.n;
    await testDb.db.transaction((tx) =>
      postAnnouncement(tx, tenantId, {
        buildingId,
        titleTh: 'แจ้งปิดน้ำ',
        titleEn: 'Water shut-off',
        bodyTh: 'ปิดน้ำวันเสาร์ 09:00–12:00',
        bodyEn: 'Water off Saturday 09:00–12:00',
        publishedAt: new Date(),
      }),
    );
    const home = await loadTenantHome(testDb.db, tenantId, today());
    expect(home!.announcements.some((a) => a.titleEn === 'Water shut-off')).toBe(true);
    const after = (await testDb.db.execute<{ n: number }>(sql`select count(*)::int as n from platform.event where tenant_id = ${tenantId}::uuid`)).rows[0]!.n;
    expect(after).toBe(before + 1);
    const posted = await loadAnnouncements(testDb.db, tenantId, buildingId, today());
    expect(posted.length).toBeGreaterThan(0);
  });

  it('a request for a room that is not on this tenant is refused and records no event', async () => {
    const before = (await testDb.db.transaction((tx) => withTenant(tx, tenantId).select(event))).length;
    await expect(
      testDb.db.transaction((tx) =>
        createRepairTicket(tx, tenantId, {
          roomId: '00000000-0000-0000-0000-00000000ffff',
          renterId: null,
          category: 'other',
          description: 'x',
          preferredTime: 'anytime',
          allowEntry: false,
        }),
      ),
    ).rejects.toMatchObject({ code: 'room.not_found' });
    const after = (await testDb.db.transaction((tx) => withTenant(tx, tenantId).select(event))).length;
    expect(after).toBe(before);
  });
});
