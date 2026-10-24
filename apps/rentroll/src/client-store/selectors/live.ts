import { isLiveContract } from '@/src/domain/property';
import type { Op } from '../ops';
import type { Data } from '../schema';
import { loadAnnouncements, loadBills, tenantContract } from './tenant';

/**
 * Selectors for the live loop's screens (R4): the pay screen, the receipt, the tenant's messages, the owner's feed,
 * and the split view's counts. Pure, like the others.
 */

const OPEN_REPAIR_STATUSES = ['new', 'scheduled', 'in_progress'];

/** The invoice to pay, with its room and building, and how much is still owed. */
export function loadPayInvoice(data: Data, invoiceId: string) {
  const invoice = data.invoice.find((i) => i.id === invoiceId);
  const contract =
    invoice && data.contract.find((c) => c.id === invoice.contractId);
  const room = contract && data.room.find((r) => r.id === contract.roomId);
  const building = room && data.building.find((b) => b.id === room.buildingId);
  if (!invoice || !contract || !room || !building) return null;
  return {
    invoice,
    roomNumber: room.number,
    buildingNameTh: building.nameTh,
    buildingNameEn: building.nameEn,
    outstandingSatang: invoice.totalSatang - invoice.paidSatang,
    pendingSlips: data.payment.filter(
      (p) => p.contractId === contract.id && p.status === 'pending_review',
    ).length,
  };
}

/** One approved payment on the tenant's contract, with the invoices it settled. */
export function loadReceipt(data: Data, paymentId: string, today: string) {
  const current = tenantContract(data, today);
  if (!current) return null;
  const payment = data.payment.find(
    (p) =>
      p.id === paymentId &&
      p.contractId === current.contractId &&
      p.status === 'approved',
  );
  if (!payment) return null;
  const paid = data.payment_allocation
    .filter((a) => a.paymentId === payment.id)
    .map((a) => ({
      invoiceNumber:
        data.invoice.find((i) => i.id === a.invoiceId)?.number ?? '',
      amountSatang: a.amountSatang,
    }));
  return { payment, paid };
}

/** The tenant's bills and usage, for the bills screen. */
export function loadBillsFor(data: Data, today: string) {
  const current = tenantContract(data, today);
  if (!current) return null;
  return {
    roomNumber: current.roomNumber,
    ...loadBills(data, current.contractId, current.roomId),
  };
}

/** Each message in the tenant's chat: a bill sent, a receipt issued, or an announcement. Oldest first. */
export type TenantMessage =
  | {
      kind: 'bill';
      id: string;
      at: string;
      number: string;
      totalSatang: number;
      dueDate: string;
    }
  | {
      kind: 'receipt';
      id: string;
      at: string;
      receiptNumber: string;
      amountSatang: number;
    }
  | {
      kind: 'reminder';
      id: string;
      at: string;
      number: string;
      daysOverdue: number;
      outstandingSatang: number;
    }
  | {
      kind: 'announcement';
      id: string;
      at: string;
      titleTh: string;
      titleEn: string;
      bodyTh: string;
      bodyEn: string;
    };

export function tenantMessages(
  data: Data,
  today: string,
  ops: Op[] = [],
): TenantMessage[] {
  const current = tenantContract(data, today);
  if (!current) return [];
  const bills: TenantMessage[] = data.invoice
    .filter((i) => i.contractId === current.contractId && i.status !== 'draft')
    .map((i) => ({
      kind: 'bill',
      id: `bill-${i.id}`,
      at: i.sentAt ?? `${i.issueDate}T02:00:00.000Z`,
      number: i.number,
      totalSatang: i.totalSatang,
      dueDate: i.dueDate,
    }));
  const receipts: TenantMessage[] = data.payment
    .filter(
      (p) =>
        p.contractId === current.contractId &&
        p.status === 'approved' &&
        p.receiptNumber,
    )
    .map((p) => ({
      kind: 'receipt',
      id: `receipt-${p.id}`,
      at: p.paidAt,
      receiptNumber: p.receiptNumber!,
      amountSatang: p.amountSatang,
    }));
  const notices: TenantMessage[] = loadAnnouncements(
    data,
    current.buildingId,
    today,
  ).map((a) => ({
    kind: 'announcement',
    id: `announcement-${a.id}`,
    at: a.publishedAt,
    titleTh: a.titleTh,
    titleEn: a.titleEn,
    bodyTh: a.bodyTh,
    bodyEn: a.bodyEn,
  }));
  const reminders: TenantMessage[] = ops
    .filter(
      (op): op is Extract<Op, { kind: 'message.mock' }> =>
        op.kind === 'message.mock',
    )
    .filter((op) =>
      data.invoice.some(
        (inv) =>
          inv.id === op.payload.invoiceId &&
          inv.contractId === current.contractId,
      ),
    )
    .map((op) => ({
      kind: 'reminder' as const,
      id: `reminder-${op.id}`,
      at: op.at,
      number:
        data.invoice.find((inv) => inv.id === op.payload.invoiceId)?.number ??
        '',
      daysOverdue: op.payload.daysOverdue,
      outstandingSatang: op.payload.outstandingSatang,
    }));
  return [...bills, ...receipts, ...notices, ...reminders].sort((a, b) =>
    a.at.localeCompare(b.at),
  );
}

/** Live contracts with the room and the primary renter, for the owner's manual payment form. */
export function loadPayableContracts(data: Data, today: string) {
  return data.contract
    .filter((c) => isLiveContract(c, today))
    .map((c) => {
      const room = data.room.find((r) => r.id === c.roomId)!;
      const primary = data.contract_renter.find(
        (cr) => cr.contractId === c.id && cr.isPrimary,
      );
      const renter =
        primary && data.renter.find((r) => r.id === primary.renterId);
      return {
        contractId: c.id,
        roomNumber: room.number,
        renterName: renter?.name ?? null,
      };
    })
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
}

/** The owner's side of the split: what the visitor did, newest first, as feed events. */
export type FeedEvent = {
  id: number;
  kind: string;
  at: string;
  payload: Record<string, unknown>;
};

export function ownerFeed(ops: Op[]): FeedEvent[] {
  const events: FeedEvent[] = [];
  ops.forEach((op) => {
    const base = { id: events.length, at: op.at };
    switch (op.kind) {
      case 'slip.submit':
        events.push({
          ...base,
          kind: 'slip.submitted',
          payload: { amountSatang: op.payload.amountSatang },
        });
        break;
      case 'payment.approve':
        events.push({
          ...base,
          kind: 'payment.approved',
          payload: { receiptNumber: op.payload.receiptNumber },
        });
        break;
      case 'payment.record':
        events.push({
          ...base,
          kind: 'payment.approved',
          payload: { receiptNumber: op.payload.receiptNumber },
        });
        break;
      case 'payment.reject':
        events.push({
          ...base,
          kind: 'payment.rejected',
          payload: { reason: op.payload.reason },
        });
        break;
    }
  });
  return events
    .map((e, index) => ({ ...e, id: index }))
    .reverse()
    .slice(0, 12);
}

/** Slips waiting for the owner, and repairs still open, for the split view's counters. */
export function feedCounts(data: Data) {
  return {
    slipsWaiting: data.payment.filter((p) => p.status === 'pending_review')
      .length,
    openRepairs: data.repair_ticket.filter((t) =>
      OPEN_REPAIR_STATUSES.includes(t.status),
    ).length,
  };
}
