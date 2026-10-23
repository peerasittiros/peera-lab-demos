import { ActionError, event, getDemoTenant, withTenant } from '@peera/db';
import { createTestDb, type TestDb } from '@peera/db/testing';
import { sql } from 'drizzle-orm';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { demoApp } from './demo-app';
import { rentrollMigrations } from './migrations';
import { loadBillingPlan } from './queries/billing';
import { loadRepairBoard } from './queries/repairs';
import { loadProperty } from './queries/property';
import { loadRepairs } from './queries/tenant';
import { buildSeed } from './seed/generator';
import { insertSeed } from './seed/insert';
import { generateBilling, previewBilling } from './writes/billing';
import { addOwnerNote, updateTicket } from './writes/repairs';
import { createRepairTicket } from './writes/tenant';
import { bangkokDate } from '../domain/dates';

let testDb: TestDb;
let tenantId: string;
const today = () => bangkokDate(new Date());

beforeAll(async () => {
  testDb = await createTestDb([rentrollMigrations]);
  const data = buildSeed();
  await testDb.db.transaction((tx) => insertSeed(tx, data));
  ({ tenantId } = await getDemoTenant(testDb.db, demoApp, { sid: crypto.randomUUID(), variant: 'apartment' }));
});

afterAll(async () => {
  await testDb?.cleanup();
});

async function openTicket(roomId: string, category: 'plumbing' | 'other' = 'plumbing') {
  const { ticketId } = await testDb.db.transaction((tx) =>
    createRepairTicket(tx, tenantId, {
      roomId,
      renterId: null,
      category,
      description: 'ก๊อกน้ำรั่ว',
      preferredTime: 'anytime',
      allowEntry: true,
    }),
  );
  return ticketId;
}

describe('owner board', () => {
  it('moves a ticket through its statuses, sets closed_at when done, and refuses to move it again', async () => {
    const { rooms } = await loadProperty(testDb.db, tenantId, today());
    const ticketId = await openTicket(rooms[0]!.id);
    await testDb.db.transaction((tx) => updateTicket(tx, tenantId, { ticketId, status: 'scheduled', assignee: 'ช่างสมชาย' }));
    await testDb.db.transaction((tx) => updateTicket(tx, tenantId, { ticketId, status: 'in_progress' }));
    await testDb.db.transaction((tx) => updateTicket(tx, tenantId, { ticketId, status: 'done' }));

    const board = await loadRepairBoard(testDb.db, tenantId);
    const ticket = board.find((t) => t.id === ticketId)!;
    expect(ticket.status).toBe('done');
    expect(ticket.assignee).toBe('ช่างสมชาย');

    await expect(
      testDb.db.transaction((tx) => updateTicket(tx, tenantId, { ticketId, status: 'in_progress' })),
    ).rejects.toMatchObject({ code: 'repair.closed' });
  });

  it('refuses to bill the tenant without a cost above zero', async () => {
    const { rooms } = await loadProperty(testDb.db, tenantId, today());
    const ticketId = await openTicket(rooms[1]!.id);
    await expect(
      testDb.db.transaction((tx) => updateTicket(tx, tenantId, { ticketId, billToRenter: true })),
    ).rejects.toBeInstanceOf(ActionError);
  });

  it('records an event for each change, and an owner note reaches the tenant timeline', async () => {
    const { rooms } = await loadProperty(testDb.db, tenantId, today());
    const roomId = rooms[2]!.id;
    const ticketId = await openTicket(roomId);
    await testDb.db.transaction((tx) => updateTicket(tx, tenantId, { ticketId, status: 'scheduled' }));
    await testDb.db.transaction((tx) => addOwnerNote(tx, tenantId, { ticketId, body: 'พรุ่งนี้ 10:00 น. ครับ' }));

    const events = await testDb.db.transaction((tx) => withTenant(tx, tenantId).select(event));
    const updates = events.filter((e) => e.kind === 'repair.updated' && (e.payload as { ticketId?: string }).ticketId === ticketId);
    expect(updates.length).toBe(2);

    const timeline = (await loadRepairs(testDb.db, tenantId, roomId)).find((t) => t.id === ticketId)!;
    expect(timeline.messages.some((m) => m.authorRole === 'owner' && m.body === 'พรุ่งนี้ 10:00 น. ครับ')).toBe(true);
    expect(timeline.status).toBe('scheduled');
  });
});

describe('bill the tenant', () => {
  it('a done repair billed to the tenant appears in the next billing run, once', async () => {
    const buildings = (await loadProperty(testDb.db, tenantId, today())).buildings;
    const buildingId = buildings[0]!.id;
    const plan = await loadBillingPlan(testDb.db, tenantId, { buildingId, period: today().slice(0, 7), today: today() });
    const target = plan!.rooms.find((r) => !r.existingInvoiceId && r.electricity && r.water)!;
    const ticketId = await openTicket(target.roomId, 'other');
    await testDb.db.transaction((tx) =>
      updateTicket(tx, tenantId, { ticketId, status: 'done', costSatang: 50000, billToRenter: true }),
    );

    const again = await loadBillingPlan(testDb.db, tenantId, { buildingId, period: today().slice(0, 7), today: today() });
    const row = again!.rooms.find((r) => r.roomId === target.roomId)!;
    expect(row.repairCharges).toEqual([{ ticketId, amount: 50000 }]);
    const preview = previewBilling(again!, [], new Date(), today().slice(0, 7)).find((p) => p.roomId === target.roomId)!;
    expect(preview.lines.some((l) => l.kind === 'one_off' && l.amount === 50000)).toBe(true);

    const estimates = again!.rooms.filter((r) => !r.existingInvoiceId && (r.electricity?.current == null || r.water?.current == null)).map((r) => r.roomId);
    await testDb.db.transaction((tx) =>
      generateBilling(tx, tenantId, { buildingId, period: today().slice(0, 7), estimateRoomIds: estimates, asOf: new Date(), today: today() }),
    );

    const { rows } = await testDb.db.execute<{ kind: string; amount_satang: number; meta: { ticketId?: string } }>(
      sql`
        select l.kind, l.amount_satang, l.meta from rentroll.invoice_line l
        join rentroll.invoice i on i.id = l.invoice_id
        where i.tenant_id = ${tenantId}::uuid and i.contract_id = ${target.contractId}::uuid and i.period = ${today().slice(0, 7)} and l.kind = 'one_off'`,
    );
    expect(rows.length).toBe(1);
    expect(Number(rows[0]!.amount_satang)).toBe(50000);
    expect(rows[0]!.meta.ticketId).toBe(ticketId);

    const afterBilling = await loadBillingPlan(testDb.db, tenantId, { buildingId, period: today().slice(0, 7), today: today() });
    expect(afterBilling!.rooms.find((r) => r.roomId === target.roomId)!.repairCharges).toEqual([]);
  });
});
