import { ActionError, getDemoTenant } from '@peera/db';
import { createTestDb, type TestDb } from '@peera/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoApp } from './demo-app';
import { runOverdueReminders } from './jobs/overdue';
import { rentrollMigrations } from './migrations';
import { loadOverdue, loadPayableContracts, loadReviewQueue } from './queries/payments';
import { buildSeed } from './seed/generator';
import { insertSeed } from './seed/insert';
import { approvePayment, recordManualPayment, rejectPayment, sendReminder, submitSlip } from './writes/payments';
import { bangkokDate, dayNumber } from '../domain/dates';

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

async function openOf(contractId: string) {
  const { rows } = await testDb.db.execute<{ id: string; number: string; due_date: string; outstanding: number; status: string }>(sql`
    select id, number, due_date, (total_satang - paid_satang)::int as outstanding, status
    from rentroll.invoice
    where tenant_id = ${tenantId}::uuid and contract_id = ${contractId}::uuid and status in ('sent', 'partially_paid')
    order by due_date, id`);
  return rows;
}

async function invoiceRow(id: string) {
  const { rows } = await testDb.db.execute<{ status: string; paid: string; total: string }>(sql`
    select status, paid_satang::text as paid, total_satang::text as total from rentroll.invoice where id = ${id}::uuid`);
  return rows[0]!;
}

/** A contract with at least one open invoice, preferring one with two (for the oldest-first check). */
async function pickContract() {
  const contracts = await loadPayableContracts(testDb.db, tenantId);
  for (const c of contracts) {
    if ((await openOf(c.contractId)).length >= 2) return c.contractId;
  }
  return contracts[0]!.contractId;
}

describe('overdue and reminders', () => {
  it('lists overdue invoices with days overdue measured in Bangkok days', async () => {
    const rows = await loadOverdue(testDb.db, tenantId, today(), new Date());
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.daysOverdue).toBe(dayNumber(today()) - dayNumber(row.dueDate));
      expect(row.daysOverdue).toBeGreaterThan(0);
      expect(row.lateFeeSatang).toBeGreaterThanOrEqual(0);
    }
  });

  it('a manual reminder is recorded once per invoice per day in the history, and the daily job skips a day already reminded', async () => {
    const [target] = await loadOverdue(testDb.db, tenantId, today(), new Date());
    await testDb.db.transaction((tx) => sendReminder(tx, tenantId, { invoiceId: target!.invoiceId, today: today() }));
    const after = await loadOverdue(testDb.db, tenantId, today(), new Date());
    expect(after.find((r) => r.invoiceId === target!.invoiceId)!.reminders.map((r) => r.date)).toEqual([today()]);

    const first = await runOverdueReminders(testDb.db, today());
    expect(first.sent).toBeGreaterThan(0);
    const second = await runOverdueReminders(testDb.db, today());
    expect(second.sent).toBe(0);
  });

  it('refuses a reminder for an invoice that is not overdue', async () => {
    const { rows } = await testDb.db.execute<{ id: string }>(sql`
      select id from rentroll.invoice where tenant_id = ${tenantId}::uuid and status in ('sent','partially_paid') and due_date >= ${today()} limit 1`);
    if (rows.length === 0) return;
    await expect(
      testDb.db.transaction((tx) => sendReminder(tx, tenantId, { invoiceId: rows[0]!.id, today: today() })),
    ).rejects.toMatchObject({ code: 'invoice.not_overdue' });
  });
});

describe('slips and approval', () => {
  it('a slip waits for review and moves nothing on the invoice', async () => {
    const contractId = await pickContract();
    const [oldest] = await openOf(contractId);
    const before = await invoiceRow(oldest!.id);
    const { paymentId } = await testDb.db.transaction((tx) =>
      submitSlip(tx, tenantId, { invoiceId: oldest!.id, amountSatang: 10000, slipUrl: null, paidAt: new Date() }),
    );
    expect(await invoiceRow(oldest!.id)).toEqual(before);
    const queue = await loadReviewQueue(testDb.db, tenantId);
    expect(queue.some((item) => item.id === paymentId)).toBe(true);
  });

  it('refuses a slip larger than what the contract owes', async () => {
    const contractId = await pickContract();
    const [oldest] = await openOf(contractId);
    const owed = (await openOf(contractId)).reduce((sum, i) => sum + i.outstanding, 0);
    await expect(
      testDb.db.transaction((tx) =>
        submitSlip(tx, tenantId, { invoiceId: oldest!.id, amountSatang: owed + 1, slipUrl: null, paidAt: new Date() }),
      ),
    ).rejects.toMatchObject({ code: 'payment.exceeds_balance' });
  });

  it('approving part of a slip settles the oldest invoice first and issues a receipt', async () => {
    const contractId = await pickContract();
    const open = await openOf(contractId);
    const owed = open.reduce((sum, i) => sum + i.outstanding, 0);
    const amount = Math.max(1, Math.floor(owed / 2));
    const { paymentId } = await testDb.db.transaction((tx) =>
      submitSlip(tx, tenantId, { invoiceId: open[0]!.id, amountSatang: amount, slipUrl: null, paidAt: new Date() }),
    );
    const paidBefore = Number((await invoiceRow(open[0]!.id)).paid);
    const approved = await testDb.db.transaction((tx) => approvePayment(tx, tenantId, { paymentId, reviewer: 'test' }));
    expect(approved.receiptNumber).toMatch(/^RCT-\d{4}-\d{2}-\d{4}$/);
    expect(approved.allocations.reduce((sum, a) => sum + a.amount, 0)).toBe(amount);
    expect(approved.allocations[0]!.invoiceId).toBe(open[0]!.id);

    const first = await invoiceRow(open[0]!.id);
    const expectedFirst = Math.min(amount, open[0]!.outstanding);
    expect(Number(first.paid)).toBe(paidBefore + expectedFirst);
    const after = await openOf(contractId);
    expect(after.reduce((sum, i) => sum + i.outstanding, 0)).toBe(owed - amount);
  });

  it('a decided slip cannot be approved again', async () => {
    const contractId = await pickContract();
    const [oldest] = await openOf(contractId);
    const { paymentId } = await testDb.db.transaction((tx) =>
      submitSlip(tx, tenantId, { invoiceId: oldest!.id, amountSatang: 100, slipUrl: null, paidAt: new Date() }),
    );
    await testDb.db.transaction((tx) => approvePayment(tx, tenantId, { paymentId, reviewer: 'test' }));
    await expect(
      testDb.db.transaction((tx) => approvePayment(tx, tenantId, { paymentId, reviewer: 'test' })),
    ).rejects.toMatchObject({ code: 'payment.not_pending' });
  });

  it('a rejected slip records the reason and leaves the invoice alone', async () => {
    const contractId = await pickContract();
    const [oldest] = await openOf(contractId);
    const before = await invoiceRow(oldest!.id);
    const { paymentId } = await testDb.db.transaction((tx) =>
      submitSlip(tx, tenantId, { invoiceId: oldest!.id, amountSatang: 100, slipUrl: null, paidAt: new Date() }),
    );
    await testDb.db.transaction((tx) => rejectPayment(tx, tenantId, { paymentId, reason: 'ยอดไม่ตรง', reviewer: 'test' }));
    expect(await invoiceRow(oldest!.id)).toEqual(before);
    const { rows } = await testDb.db.execute<{ status: string; reject_reason: string }>(sql`
      select status, reject_reason from rentroll.payment where id = ${paymentId}::uuid`);
    expect(rows[0]).toEqual({ status: 'rejected', reject_reason: 'ยอดไม่ตรง' });
  });

  it('a manual payment for the rest of the balance settles every open invoice, with the next receipt number', async () => {
    const contractId = await pickContract();
    const owed = (await openOf(contractId)).reduce((sum, i) => sum + i.outstanding, 0);
    const manual = await testDb.db.transaction((tx) =>
      recordManualPayment(tx, tenantId, {
        contractId,
        amountSatang: owed,
        method: 'cash',
        paidAt: new Date(),
        reviewer: 'test',
      }),
    );
    expect(manual.receiptNumber).toMatch(/^RCT-\d{4}-\d{2}-\d{4}$/);
    expect(await openOf(contractId)).toEqual([]);
  });

  it('receipts count up with no gaps', async () => {
    const contracts = await loadPayableContracts(testDb.db, tenantId);
    const numbers: number[] = [];
    for (const c of contracts.slice(0, 3)) {
      const owed = c.owedSatang;
      if (owed <= 0) continue;
      const r = await testDb.db.transaction((tx) =>
        recordManualPayment(tx, tenantId, {
          contractId: c.contractId,
          amountSatang: owed,
          method: 'transfer',
          paidAt: new Date(),
          reviewer: 'test',
        }),
      );
      numbers.push(Number(r.receiptNumber.split('-').at(-1)));
    }
    for (let i = 1; i < numbers.length; i += 1) expect(numbers[i]).toBe(numbers[i - 1]! + 1);
  });

  it('refuses a manual payment larger than the balance', async () => {
    const contracts = await loadPayableContracts(testDb.db, tenantId);
    const paid = contracts.find((c) => c.owedSatang === 0);
    if (!paid) return;
    await expect(
      testDb.db.transaction((tx) =>
        recordManualPayment(tx, tenantId, { contractId: paid.contractId, amountSatang: 100, method: 'cash', paidAt: new Date(), reviewer: 'test' }),
      ),
    ).rejects.toBeInstanceOf(ActionError);
  });
});
