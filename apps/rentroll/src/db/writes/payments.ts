import { ActionError, mockMessage, withTenant, type Tx } from '@peera/db';
import { and, eq, inArray } from 'drizzle-orm';
import { allocatePayment, type OpenInvoice } from '../../domain/payments';
import { formatDocumentNumber, type YearStyle } from '../../domain/numbering';
import { bangkokDate, dayNumber } from '../../domain/dates';
import { building, contract, invoice, paymentAllocation, payment, room } from '../schema';
import { nextDocumentNumber } from './contracts';
import { recordEvent } from './tenant';

/** Sent or partly paid invoices of a contract, locked for the transaction, with what each still owes. */
async function openInvoices(tx: Tx, tenantId: string, contractId: string): Promise<(OpenInvoice & { total: number; paid: number })[]> {
  const scope = withTenant(tx, tenantId);
  const rows = await scope
    .select(invoice, and(eq(invoice.contractId, contractId), inArray(invoice.status, ['sent', 'partially_paid'])))
    .for('update');
  return rows.map((i) => ({
    id: i.id,
    dueDate: i.dueDate,
    outstanding: i.totalSatang - i.paidSatang,
    total: i.totalSatang,
    paid: i.paidSatang,
  }));
}

/**
 * Applies money to a contract's open invoices, oldest first (01 §4). Each invoice's paid amount and status move
 * forward; the invoice's identity and totals do not change, so the migration 0002 guard allows it.
 */
async function applyToContract(
  tx: Tx,
  tenantId: string,
  paymentId: string,
  contractId: string,
  amount: number,
): Promise<{ allocations: { invoiceId: string; amount: number }[]; receiptNumber: string }> {
  const scope = withTenant(tx, tenantId);
  const open = await openInvoices(tx, tenantId, contractId);
  const owed = open.reduce((sum, i) => sum + i.outstanding, 0);
  if (amount > owed) throw new ActionError('payment.exceeds_balance', 'payments.errors.exceedsBalance');
  const { allocations } = allocatePayment(amount, open);
  for (const allocation of allocations) {
    await scope.insert(paymentAllocation, [{ paymentId, invoiceId: allocation.invoiceId, amountSatang: allocation.amount }]);
    const target = open.find((i) => i.id === allocation.invoiceId)!;
    const paid = target.paid + allocation.amount;
    await scope.update(
      invoice,
      { paidSatang: paid, status: paid >= target.total ? 'paid' : 'partially_paid' },
      eq(invoice.id, allocation.invoiceId),
    );
  }

  const [contractRow] = await scope.select(contract, eq(contract.id, contractId));
  const [roomRow] = await scope.select(room, eq(room.id, contractRow!.roomId));
  const [buildingRow] = await scope.select(building, eq(building.id, roomRow!.buildingId));
  // The receipt belongs to the Bangkok month it is issued in, not the UTC one.
  const [year, month] = bangkokDate(new Date()).split('-').map(Number);
  const sequence = await nextDocumentNumber(tx, tenantId, buildingRow!.id, 'RCT', year!);
  const receiptNumber = formatDocumentNumber({
    prefix: 'RCT',
    ceYear: year!,
    month: month!,
    sequence,
    style: buildingRow!.invoiceYearStyle as YearStyle,
  });
  return { allocations, receiptNumber };
}

/** A tenant's slip: recorded for the owner's review. Nothing moves on the invoice until it is approved. */
export async function submitSlip(
  tx: Tx,
  tenantId: string,
  input: { invoiceId: string; amountSatang: number; slipUrl: string | null; paidAt: Date },
) {
  const scope = withTenant(tx, tenantId);
  const [target] = await scope.select(invoice, eq(invoice.id, input.invoiceId));
  if (!target || (target.status !== 'sent' && target.status !== 'partially_paid')) {
    throw new ActionError('invoice.not_payable', 'payments.errors.notPayable');
  }
  const owed = await openInvoices(tx, tenantId, target.contractId);
  const total = owed.reduce((sum, i) => sum + i.outstanding, 0);
  if (input.amountSatang <= 0 || input.amountSatang > total) {
    throw new ActionError('payment.exceeds_balance', 'payments.errors.exceedsBalance');
  }
  const [created] = await scope
    .insert(payment, [
      {
        contractId: target.contractId,
        amountSatang: input.amountSatang,
        method: 'promptpay',
        paidAt: input.paidAt,
        slipUrl: input.slipUrl,
        status: 'pending_review',
      },
    ])
    .returning({ id: payment.id });
  await recordEvent(tx, tenantId, 'slip.submitted', { paymentId: created!.id, amountSatang: input.amountSatang });
  return { paymentId: created!.id };
}

/** Approves a pending slip for `amount` (defaults to the slip amount) and issues the receipt. */
export async function approvePayment(
  tx: Tx,
  tenantId: string,
  input: { paymentId: string; amountSatang?: number; reviewer: string },
) {
  const scope = withTenant(tx, tenantId);
  const [found] = await scope.select(payment, eq(payment.id, input.paymentId));
  if (!found) throw new ActionError('payment.not_found', 'payments.errors.notFound');
  if (found.status !== 'pending_review') throw new ActionError('payment.not_pending', 'payments.errors.notPending');
  const amount = input.amountSatang ?? found.amountSatang;
  if (amount <= 0 || amount > found.amountSatang) {
    throw new ActionError('payment.invalid_amount', 'payments.errors.invalidAmount');
  }
  const applied = await applyToContract(tx, tenantId, found.id, found.contractId, amount);
  await scope.update(
    payment,
    { status: 'approved', amountSatang: amount, reviewedBy: input.reviewer, receiptNumber: applied.receiptNumber },
    eq(payment.id, found.id),
  );
  await recordEvent(tx, tenantId, 'payment.approved', { paymentId: found.id, receiptNumber: applied.receiptNumber });
  return { paymentId: found.id, receiptNumber: applied.receiptNumber, allocations: applied.allocations };
}

export async function rejectPayment(tx: Tx, tenantId: string, input: { paymentId: string; reason: string; reviewer: string }) {
  const scope = withTenant(tx, tenantId);
  const [found] = await scope.select(payment, eq(payment.id, input.paymentId));
  if (!found) throw new ActionError('payment.not_found', 'payments.errors.notFound');
  if (found.status !== 'pending_review') throw new ActionError('payment.not_pending', 'payments.errors.notPending');
  await scope.update(
    payment,
    { status: 'rejected', rejectReason: input.reason, reviewedBy: input.reviewer },
    eq(payment.id, found.id),
  );
  return { paymentId: found.id };
}

/** Cash or transfer recorded by the owner: approved at once and allocated the same way as a slip. */
export async function recordManualPayment(
  tx: Tx,
  tenantId: string,
  input: { contractId: string; amountSatang: number; method: 'cash' | 'transfer'; paidAt: Date; reviewer: string },
) {
  const scope = withTenant(tx, tenantId);
  const [created] = await scope
    .insert(payment, [
      {
        contractId: input.contractId,
        amountSatang: input.amountSatang,
        method: input.method,
        paidAt: input.paidAt,
        slipUrl: null,
        status: 'approved',
        reviewedBy: input.reviewer,
      },
    ])
    .returning({ id: payment.id });
  const applied = await applyToContract(tx, tenantId, created!.id, input.contractId, input.amountSatang);
  await scope.update(payment, { receiptNumber: applied.receiptNumber }, eq(payment.id, created!.id));
  return { paymentId: created!.id, receiptNumber: applied.receiptNumber, allocations: applied.allocations };
}

/** A reminder is recorded in the message log (the mock LINE channel); it is not sent anywhere. */
export async function sendReminder(tx: Tx, tenantId: string, input: { invoiceId: string; today: string }) {
  const scope = withTenant(tx, tenantId);
  const [target] = await scope.select(invoice, eq(invoice.id, input.invoiceId));
  if (!target || (target.status !== 'sent' && target.status !== 'partially_paid') || target.dueDate >= input.today) {
    throw new ActionError('invoice.not_overdue', 'payments.errors.notOverdue');
  }
  const outstanding = target.totalSatang - target.paidSatang;
  await scope.insert(mockMessage, [
    {
      channel: 'line',
      payload: {
        kind: 'overdue_reminder',
        invoiceId: target.id,
        number: target.number,
        dueDate: target.dueDate,
        daysOverdue: dayNumber(input.today) - dayNumber(target.dueDate),
        outstanding,
        date: input.today,
      },
    },
  ]);
  return { invoiceId: target.id, outstanding };
}
