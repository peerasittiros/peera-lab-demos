import { mockMessage, withTenant, type Queryable } from '@peera/db';
import { and, eq, inArray } from 'drizzle-orm';
import { dayNumber } from '../../domain/dates';
import { lateFee, type LateFeeRule } from '../../domain/late-fee';
import { ratePlanOn } from '../../domain/property';
import { building, contract, contractRenter, invoice, payment, ratePlan, renter, room } from '../schema';

/** Renter, room and building for a contract, read inside the tenant. */
async function contractContext(db: Queryable, tenantId: string, contractId: string) {
  const scope = withTenant(db, tenantId);
  const [c] = await scope.select(contract, eq(contract.id, contractId));
  if (!c) return null;
  const [r] = await scope.select(room, eq(room.id, c.roomId));
  const [b] = await scope.select(building, eq(building.id, r!.buildingId));
  const links = await scope.select(contractRenter, eq(contractRenter.contractId, contractId));
  const primary = links.find((l) => l.isPrimary);
  const [renterRow] = primary ? await scope.select(renter, eq(renter.id, primary.renterId)) : [];
  return { contract: c, room: r!, building: b!, renterName: renterRow?.name ?? null };
}

export type ReviewItem = {
  id: string;
  amountSatang: number;
  paidAt: string;
  slipUrl: string | null;
  roomNumber: string;
  renterName: string | null;
  open: { id: string; number: string; outstanding: number; dueDate: string }[];
  owedSatang: number;
};

/** The owner's review queue: slips waiting for a decision, each with the invoices it can settle. */
export async function loadReviewQueue(db: Queryable, tenantId: string): Promise<ReviewItem[]> {
  const scope = withTenant(db, tenantId);
  const pending = await scope.select(payment, eq(payment.status, 'pending_review'));
  const items: ReviewItem[] = [];
  for (const p of pending) {
    const ctx = await contractContext(db, tenantId, p.contractId);
    if (!ctx) continue;
    const invoices = await scope.select(
      invoice,
      and(eq(invoice.contractId, p.contractId), inArray(invoice.status, ['sent', 'partially_paid'])),
    );
    const open = invoices
      .map((i) => ({ id: i.id, number: i.number, outstanding: i.totalSatang - i.paidSatang, dueDate: i.dueDate }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
    items.push({
      id: p.id,
      amountSatang: p.amountSatang,
      paidAt: p.paidAt.toISOString(),
      slipUrl: p.slipUrl,
      roomNumber: ctx.room.number,
      renterName: ctx.renterName,
      open,
      owedSatang: open.reduce((sum, i) => sum + i.outstanding, 0),
    });
  }
  return items.sort((a, b) => a.paidAt.localeCompare(b.paidAt));
}

export type OverdueRow = {
  invoiceId: string;
  number: string;
  roomNumber: string;
  renterName: string | null;
  dueDate: string;
  daysOverdue: number;
  outstandingSatang: number;
  lateFeeSatang: number;
  reminders: { date: string }[];
};

/** Unpaid invoices past their due date, with the late fee accrued so far and the reminders sent. */
export async function loadOverdue(db: Queryable, tenantId: string, today: string, asOf: Date): Promise<OverdueRow[]> {
  const scope = withTenant(db, tenantId);
  const overdue = await scope.select(invoice, inArray(invoice.status, ['sent', 'partially_paid']));
  const late = overdue.filter((i) => i.dueDate < today);
  const messages = await scope.select(mockMessage);
  const remindersOf = new Map<string, string[]>();
  for (const message of messages) {
    const p = message.payload as { kind?: string; invoiceId?: string; date?: string };
    if (p.kind !== 'overdue_reminder' || !p.invoiceId || !p.date) continue;
    remindersOf.set(p.invoiceId, [...(remindersOf.get(p.invoiceId) ?? []), p.date]);
  }
  const rows: OverdueRow[] = [];
  for (const i of late) {
    const ctx = await contractContext(db, tenantId, i.contractId);
    if (!ctx) continue;
    const plans = await scope.select(ratePlan, eq(ratePlan.buildingId, ctx.building.id));
    const plan = ratePlanOn(plans, today);
    const rule: LateFeeRule | null = plan
      ? { mode: plan.lateFeeRule.kind, amount: plan.lateFeeRule.amountSatang, cap: plan.lateFeeRule.capSatang }
      : null;
    rows.push({
      invoiceId: i.id,
      number: i.number,
      roomNumber: ctx.room.number,
      renterName: ctx.renterName,
      dueDate: i.dueDate,
      daysOverdue: dayNumber(today) - dayNumber(i.dueDate),
      outstandingSatang: i.totalSatang - i.paidSatang,
      lateFeeSatang: rule ? lateFee(rule, i.dueDate, asOf) : 0,
      reminders: [...new Set(remindersOf.get(i.id) ?? [])].sort().map((date) => ({ date })),
    });
  }
  return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Everything the tenant's pay screen needs for one invoice, or null when it is not on this tenant. */
export async function loadPayInvoice(db: Queryable, tenantId: string, invoiceId: string) {
  const scope = withTenant(db, tenantId);
  const [i] = await scope.select(invoice, eq(invoice.id, invoiceId));
  if (!i) return null;
  const ctx = await contractContext(db, tenantId, i.contractId);
  if (!ctx) return null;
  const pending = await scope.select(
    payment,
    and(eq(payment.contractId, i.contractId), eq(payment.status, 'pending_review')),
  );
  const open = await scope.select(
    invoice,
    and(eq(invoice.contractId, i.contractId), inArray(invoice.status, ['sent', 'partially_paid'])),
  );
  return {
    invoice: i,
    outstandingSatang: i.totalSatang - i.paidSatang,
    owedSatang: open.reduce((sum, row) => sum + row.totalSatang - row.paidSatang, 0),
    pendingSlips: pending.length,
    roomNumber: ctx.room.number,
    renterName: ctx.renterName,
    buildingNameTh: ctx.building.nameTh,
    buildingNameEn: ctx.building.nameEn,
    bankName: ctx.building.bankName,
    bankAccountMasked: ctx.building.bankAccountMasked,
  };
}

/** Contracts with money owed, for the owner's manual payment form. */
export async function loadPayableContracts(db: Queryable, tenantId: string) {
  const scope = withTenant(db, tenantId);
  const open = await scope.select(invoice, inArray(invoice.status, ['sent', 'partially_paid']));
  const contractIds = [...new Set(open.map((i) => i.contractId))];
  const rows: { contractId: string; roomNumber: string; renterName: string | null; owedSatang: number }[] = [];
  for (const contractId of contractIds) {
    const ctx = await contractContext(db, tenantId, contractId);
    if (!ctx) continue;
    const owed = open
      .filter((i) => i.contractId === contractId)
      .reduce((sum, i) => sum + i.totalSatang - i.paidSatang, 0);
    rows.push({ contractId, roomNumber: ctx.room.number, renterName: ctx.renterName, owedSatang: owed });
  }
  return rows.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
}
