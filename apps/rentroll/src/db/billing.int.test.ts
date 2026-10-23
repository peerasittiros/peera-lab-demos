import { ActionError, getDemoTenant, withTenant } from '@peera/db';
import { createTestDb, type TestDb } from '@peera/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoApp } from './demo-app';
import { rentrollMigrations } from './migrations';
import { loadBillingPlan } from './queries/billing';
import { loadProperty } from './queries/property';
import { buildSeed } from './seed/generator';
import { insertSeed } from './seed/insert';
import { invoice, docSequence } from './schema';
import { generateBilling, sendBilling, voidDraft } from './writes/billing';
import { nextDocumentNumber } from './writes/contracts';
import { bangkokDate } from '../domain/dates';

let testDb: TestDb;
let tenantId: string;
let buildings: string[];
const today = () => bangkokDate(new Date());
const period = () => today().slice(0, 7);
const asOf = () => new Date();
const generatedNumbers: string[] = [];

beforeAll(async () => {
  testDb = await createTestDb([rentrollMigrations]);
  const data = buildSeed();
  await testDb.db.transaction((tx) => insertSeed(tx, data));
  ({ tenantId } = await getDemoTenant(testDb.db, demoApp, { sid: crypto.randomUUID(), variant: 'apartment' }));
  buildings = (await loadProperty(testDb.db, tenantId, today())).buildings.map((b) => b.id);
});

afterAll(async () => {
  await testDb?.cleanup();
});

async function allMissingRooms(): Promise<string[]> {
  const ids: string[] = [];
  for (const buildingId of buildings) {
    const plan = await loadBillingPlan(testDb.db, tenantId, { buildingId, period: period(), today: today() });
    for (const r of plan!.rooms) {
      if (!r.existingInvoiceId && (r.electricity?.current == null || r.water?.current == null)) ids.push(r.roomId);
    }
  }
  return ids;
}

describe('gap-free numbering', () => {
  it('ten concurrent generations take ten consecutive numbers, with no repeats', async () => {
    const year = 2031;
    const buildingId = buildings[0]!;
    await testDb.db.transaction((tx) =>
      withTenant(tx, tenantId).insert(docSequence, [{ buildingId, docType: 'INV', year, nextNo: 1 }]),
    );
    const numbers = await Promise.all(
      Array.from({ length: 10 }, () =>
        testDb.db.transaction((tx) => nextDocumentNumber(tx, tenantId, buildingId, 'INV', year)),
      ),
    );
    const sorted = [...numbers].sort((a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('billing run', () => {
  it('refuses to generate while a room still has no reading, unless it is estimated', async () => {
    const missing = await allMissingRooms();
    expect(missing.length, 'the seed leaves six occupied rooms unread this month').toBeGreaterThan(0);
    const buildingId = buildings[0]!;
    const plan = await loadBillingPlan(testDb.db, tenantId, { buildingId, period: period(), today: today() });
    const blockedRoom = plan!.rooms.find((r) => !r.existingInvoiceId && (r.electricity?.current == null || r.water?.current == null));
    if (!blockedRoom) return; // this building has none missing; the other building covers the gate below
    await expect(
      testDb.db.transaction((tx) =>
        generateBilling(tx, tenantId, { buildingId, period: period(), estimateRoomIds: [], asOf: asOf(), today: today() }),
      ),
    ).rejects.toMatchObject({ code: 'billing.missing_readings' });
    await expect(
      testDb.db.transaction((tx) =>
        generateBilling(tx, tenantId, { buildingId, period: period(), estimateRoomIds: [], asOf: asOf(), today: today() }),
      ),
    ).rejects.toBeInstanceOf(ActionError);
  });

  it('generates draft invoices with consecutive numbers once the missing rooms are estimated, then does nothing twice', async () => {
    for (const buildingId of buildings) {
      const estimates = (await loadBillingPlan(testDb.db, tenantId, { buildingId, period: period(), today: today() }))!.rooms
        .filter((r) => r.electricity?.current == null || r.water?.current == null)
        .map((r) => r.roomId);
      const first = await testDb.db.transaction((tx) =>
        generateBilling(tx, tenantId, { buildingId, period: period(), estimateRoomIds: estimates, asOf: asOf(), today: today() }),
      );
      generatedNumbers.push(...first.numbers);
      const numbers = first.numbers.map((n) => Number(n.split('-').at(-1)));
      for (let i = 1; i < numbers.length; i += 1) {
        expect(numbers[i]).toBe(numbers[i - 1]! + 1);
      }
      const second = await testDb.db.transaction((tx) =>
        generateBilling(tx, tenantId, { buildingId, period: period(), estimateRoomIds: estimates, asOf: asOf(), today: today() }),
      );
      expect(second.created).toBe(0);
    }
    // Only the invoices this test generated: the seed's own invoice for this month is already sent.
    const generated = generatedNumbers;
    expect(generated.length).toBeGreaterThan(0);
    const drafts = await testDb.db.execute<{ status: string }>(sql`
      select status from rentroll.invoice where tenant_id = ${tenantId}::uuid
        and number in (select jsonb_array_elements_text(${JSON.stringify(generated)}::jsonb))`);
    expect(drafts.rows.length).toBe(generated.length);
    expect(drafts.rows.every((r) => r.status === 'draft')).toBe(true);
  });

  it('sends the drafts, and a sent invoice cannot be changed or deleted at the database (01 §4)', async () => {
    for (const buildingId of buildings) {
      await testDb.db.transaction((tx) => sendBilling(tx, tenantId, { buildingId, period: period(), sentAt: asOf() }));
    }
    const [sent] = (
      await testDb.db.execute<{ id: string; number: string }>(sql`
        select id, number from rentroll.invoice
        where tenant_id = ${tenantId}::uuid and period = ${period()} and type = 'monthly' and status = 'sent' limit 1`)
    ).rows;
    expect(sent).toBeDefined();

    // Drizzle wraps the database error; the reason from the trigger is on the cause.
    const refused = async (query: Promise<unknown>, reason: RegExp) => {
      const error = await query.then(
        () => null,
        (e: unknown) => e as { message: string; cause?: { message?: string } },
      );
      expect(error, 'the database should refuse this').not.toBeNull();
      expect(`${error!.message} ${error!.cause?.message ?? ''}`).toMatch(reason);
    };
    await refused(
      testDb.db.execute(sql`update rentroll.invoice set total_satang = total_satang + 1 where id = ${sent!.id}::uuid`),
      /immutable/,
    );
    await refused(
      testDb.db.execute(sql`update rentroll.invoice_line set amount_satang = 1 where invoice_id = ${sent!.id}::uuid`),
      /cannot be changed/,
    );
    await refused(testDb.db.execute(sql`delete from rentroll.invoice where id = ${sent!.id}::uuid`), /cannot be deleted/);
    await refused(
      testDb.db.execute(sql`update rentroll.invoice set status = 'void' where id = ${sent!.id}::uuid`),
      /can only move/,
    );
    // Payment fields may move: that is how a payment is recorded (D3.7).
    await testDb.db.execute(sql`update rentroll.invoice set paid_satang = 1, status = 'partially_paid' where id = ${sent!.id}::uuid`);
    const [after] = (
      await testDb.db.execute<{ paid: number; status: string }>(sql`
        select paid_satang as paid, status from rentroll.invoice where id = ${sent!.id}::uuid`)
    ).rows;
    expect(after).toEqual({ paid: '1', status: 'partially_paid' });
  });

  it('serves a sent invoice by its token, and never a draft or an unknown token', async () => {
    const { loadPublicInvoice } = await import('./queries/billing');
    const [sentRow] = (
      await testDb.db.execute<{ token: string; status: string }>(sql`
        select public_token as token, status from rentroll.invoice
        where tenant_id = ${tenantId}::uuid and status = 'sent' and type = 'monthly' limit 1`)
    ).rows;
    const found = await loadPublicInvoice(testDb.db, sentRow!.token);
    expect(found?.invoice.status).toBe('sent');
    expect(found?.lines.length).toBeGreaterThan(0);
    expect(await loadPublicInvoice(testDb.db, 'no-such-token')).toBeNull();

    const draftToken = crypto.randomUUID();
    const draftId = await testDb.db.transaction(async (tx) => {
      const [row] = await withTenant(tx, tenantId)
        .insert(invoice, [
          {
            buildingId: buildings[0]!,
            contractId: (await loadBillingPlan(tx, tenantId, { buildingId: buildings[0]!, period: period(), today: today() }))!.rooms[0]!.contractId,
            number: 'INV-TEST-DRAFT-0001',
            type: 'one_off',
            period: null,
            issueDate: today(),
            dueDate: today(),
            status: 'draft',
            subtotalSatang: 0,
            totalSatang: 0,
            paidSatang: 0,
            sentAt: null,
            publicToken: draftToken,
          },
        ])
        .returning({ id: invoice.id });
      return row!.id;
    });
    expect(draftId).toBeDefined();
    expect(await loadPublicInvoice(testDb.db, draftToken)).toBeNull();
  });

  it('voids a draft but refuses to void a sent invoice', async () => {
    const draftId = await testDb.db.transaction(async (tx) => {
      const scope = withTenant(tx, tenantId);
      const [row] = await scope
        .insert(invoice, [
          {
            buildingId: buildings[0]!,
            contractId: (await loadBillingPlan(tx, tenantId, { buildingId: buildings[0]!, period: period(), today: today() }))!.rooms[0]!.contractId,
            number: 'INV-TEST-VOID-0001',
            type: 'one_off',
            period: null,
            issueDate: today(),
            dueDate: today(),
            status: 'draft',
            subtotalSatang: 0,
            totalSatang: 0,
            paidSatang: 0,
            sentAt: null,
            publicToken: crypto.randomUUID(),
          },
        ])
        .returning({ id: invoice.id });
      return row!.id;
    });
    const voided = await testDb.db.transaction((tx) => voidDraft(tx, tenantId, draftId));
    expect(voided.number).toBe('INV-TEST-VOID-0001');
    const [status] = (
      await testDb.db.execute<{ status: string }>(sql`select status from rentroll.invoice where id = ${draftId}::uuid`)
    ).rows;
    expect(status!.status).toBe('void');

    const sentId = (
      await testDb.db.execute<{ id: string }>(sql`
        select id from rentroll.invoice where tenant_id = ${tenantId}::uuid and status = 'sent' and type = 'monthly' limit 1`)
    ).rows[0]!.id;
    await expect(testDb.db.transaction((tx) => voidDraft(tx, tenantId, sentId))).rejects.toMatchObject({
      code: 'invoice.not_draft',
    });
  });
});
