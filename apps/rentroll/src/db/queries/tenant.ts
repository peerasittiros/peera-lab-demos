import { event, withTenant, type Queryable } from '@peera/db';
import { and, eq, inArray, lte, gt, or, isNull } from 'drizzle-orm';
import { isLiveContract } from '../../domain/property';
import {
  announcement,
  payment,
  paymentAllocation,
  contract,
  contractRenter,
  invoice,
  invoiceLine,
  meterReading,
  renter,
  repairTicket,
  room,
  ticketMessage,
} from '../schema';

/**
 * The tenant the portal shows (01 §9): room A-305 when it has a live contract, otherwise the first live contract of
 * the tenant. Returns null when the sandbox has no live contract.
 */
export async function tenantContract(db: Queryable, tenantId: string, today: string) {
  const scope = withTenant(db, tenantId);
  const rooms = await scope.select(room);
  const contracts = await scope.select(contract);
  const live = contracts.filter((c) => isLiveContract(c, today));
  const preferred = rooms.find((r) => r.number === 'A-305');
  const chosen =
    live.find((c) => c.roomId === preferred?.id) ?? live.sort((a, b) => a.roomId.localeCompare(b.roomId))[0] ?? null;
  if (!chosen) return null;
  const roomRow = rooms.find((r) => r.id === chosen.roomId)!;
  const [primary] = await scope.select(
    contractRenter,
    and(eq(contractRenter.contractId, chosen.id), eq(contractRenter.isPrimary, true)),
  );
  const [renterRow] = primary ? await scope.select(renter, eq(renter.id, primary.renterId)) : [];
  return {
    contractId: chosen.id,
    roomId: roomRow.id,
    roomNumber: roomRow.number,
    buildingId: roomRow.buildingId,
    renterId: primary?.renterId ?? null,
    renterName: renterRow?.name ?? null,
    monthlyRentSatang: chosen.monthlyRentSatang,
  };
}

export async function loadTenantHome(db: Queryable, tenantId: string, today: string) {
  const current = await tenantContract(db, tenantId, today);
  if (!current) return null;
  const scope = withTenant(db, tenantId);
  const open = await scope.select(
    invoice,
    and(eq(invoice.contractId, current.contractId), inArray(invoice.status, ['sent', 'partially_paid'])),
  );
  const owed = open.map((i) => ({ id: i.id, number: i.number, dueDate: i.dueDate, outstanding: i.totalSatang - i.paidSatang }));
  owed.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  const tickets = await scope.select(
    repairTicket,
    and(eq(repairTicket.roomId, current.roomId), inArray(repairTicket.status, ['new', 'scheduled', 'in_progress'])),
  );
  const announcements = await loadAnnouncements(db, tenantId, current.buildingId, today);
  return {
    ...current,
    balanceSatang: owed.reduce((sum, i) => sum + i.outstanding, 0),
    nextInvoice: owed[0] ?? null,
    openRepairs: tickets.length,
    announcements,
  };
}

/** Published announcements for the building that have not expired, newest first. */
export async function loadAnnouncements(db: Queryable, tenantId: string, buildingId: string, today: string) {
  const scope = withTenant(db, tenantId);
  const now = new Date(`${today}T23:59:59+07:00`);
  const rows = await scope.select(
    announcement,
    and(
      eq(announcement.buildingId, buildingId),
      lte(announcement.publishedAt, now),
      or(isNull(announcement.expiresAt), gt(announcement.expiresAt, now)),
    ),
  );
  return rows.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

/** Twelve months of bills and usage for the tenant's contract (01 §3.1 D.14). */
export async function loadBills(db: Queryable, tenantId: string, contractId: string, roomId: string) {
  const scope = withTenant(db, tenantId);
  const invoices = await scope.select(invoice, eq(invoice.contractId, contractId));
  const readings = await scope.select(meterReading, eq(meterReading.roomId, roomId));
  const usageByPeriod = new Map<string, { electricity: number | null; water: number | null }>();
  for (const r of readings) {
    const entry = usageByPeriod.get(r.period) ?? { electricity: null, water: null };
    if (r.kind === 'electricity') entry.electricity = r.unitsUsed;
    if (r.kind === 'water') entry.water = r.unitsUsed;
    usageByPeriod.set(r.period, entry);
  }
  const usage = [...usageByPeriod.entries()]
    .map(([period, units]) => ({ period, ...units }))
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 12)
    .reverse();
  const bills = invoices
    .filter((i) => i.status !== 'draft')
    .map((i) => ({
      id: i.id,
      number: i.number,
      type: i.type,
      period: i.period,
      dueDate: i.dueDate,
      status: i.status,
      totalSatang: i.totalSatang,
      paidSatang: i.paidSatang,
      publicToken: i.publicToken,
    }))
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, 12);
  return { bills, usage };
}

export async function loadTenantInvoice(db: Queryable, tenantId: string, contractId: string, invoiceId: string) {
  const scope = withTenant(db, tenantId);
  const [found] = await scope.select(invoice, and(eq(invoice.id, invoiceId), eq(invoice.contractId, contractId)));
  if (!found || found.status === 'draft') return null;
  const lines = await scope.select(invoiceLine, eq(invoiceLine.invoiceId, found.id));
  return { invoice: found, lines };
}

/** The approved receipts that paid this invoice, newest first. */
export async function loadInvoiceReceipts(db: Queryable, tenantId: string, invoiceId: string) {
  const scope = withTenant(db, tenantId);
  const allocations = await scope.select(paymentAllocation, eq(paymentAllocation.invoiceId, invoiceId));
  if (allocations.length === 0) return [];
  const payments = await scope.select(payment, inArray(payment.id, allocations.map((a) => a.paymentId)));
  return payments
    .filter((p) => p.status === 'approved' && p.receiptNumber)
    .map((p) => ({ paymentId: p.id, receiptNumber: p.receiptNumber!, amountSatang: p.amountSatang, paidAt: p.paidAt }))
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
}

/** One approved payment on this contract, with the invoices it paid. Null for a pending, rejected or foreign payment. */
export async function loadReceipt(db: Queryable, tenantId: string, contractId: string, paymentId: string) {
  const scope = withTenant(db, tenantId);
  const [found] = await scope.select(payment, and(eq(payment.id, paymentId), eq(payment.contractId, contractId)));
  if (!found || found.status !== 'approved' || !found.receiptNumber) return null;
  const allocations = await scope.select(paymentAllocation, eq(paymentAllocation.paymentId, found.id));
  const invoices = await scope.select(invoice, eq(invoice.contractId, contractId));
  const byId = new Map(invoices.map((i) => [i.id, i]));
  const paid = allocations.map((a) => ({
    invoiceNumber: byId.get(a.invoiceId)?.number ?? '—',
    period: byId.get(a.invoiceId)?.period ?? null,
    amountSatang: a.amountSatang,
  }));
  return { payment: found, paid };
}

/** The owner's side of the split: slips waiting, open repairs in the building, and the newest tenant events. */
export async function loadOwnerFeed(db: Queryable, tenantId: string) {
  const scope = withTenant(db, tenantId);
  const [payments, tickets, events] = await Promise.all([
    scope.select(payment, eq(payment.status, 'pending_review')),
    scope.select(repairTicket, inArray(repairTicket.status, ['new', 'scheduled', 'in_progress'])),
    scope.select(event),
  ]);
  return {
    slipsWaiting: payments.length,
    openRepairs: tickets.length,
    events: events
      .sort((a, b) => b.id - a.id)
      .slice(0, 8)
      .map((e) => ({ id: e.id, kind: e.kind, at: e.at.toISOString(), payload: e.payload as Record<string, unknown> })),
  };
}

export async function loadRepairs(db: Queryable, tenantId: string, roomId: string) {
  const scope = withTenant(db, tenantId);
  const tickets = await scope.select(repairTicket, eq(repairTicket.roomId, roomId));
  const messages = tickets.length === 0 ? [] : await scope.select(ticketMessage);
  return tickets
    .map((t) => ({
      id: t.id,
      category: t.category,
      description: t.description,
      status: t.status,
      preferredTime: t.preferredTime,
      allowEntry: t.allowEntry,
      createdAt: t.createdAt,
      messages: messages
        .filter((m) => m.ticketId === t.id)
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map((m) => ({ id: m.id, authorRole: m.authorRole, body: m.body, at: m.at })),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
