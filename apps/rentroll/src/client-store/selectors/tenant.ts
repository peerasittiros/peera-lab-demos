import { isLiveContract } from '@/src/domain/property';
import type { Data, Row } from '../schema';

/**
 * Selectors for the tenant side. Each mirrors a function in `src/db/queries/tenant.ts` with the same name and shape,
 * so the views port over unchanged. They are pure: they read the store's data and return plain objects.
 */

const OPEN_INVOICE_STATUSES = ['sent', 'partially_paid'];
const OPEN_TICKET_STATUSES = ['new', 'scheduled', 'in_progress'];

/**
 * The tenant the portal shows: room A-305 when it has a live contract, otherwise the first live contract (by room id).
 */
export function tenantContract(data: Data, today: string) {
  const live = data.contract.filter((c) => isLiveContract(c, today));
  const preferred = data.room.find((r) => r.number === 'A-305');
  const chosen =
    live.find((c) => c.roomId === preferred?.id) ??
    [...live].sort((a, b) => a.roomId.localeCompare(b.roomId))[0] ??
    null;
  if (!chosen) return null;
  const roomRow = data.room.find((r) => r.id === chosen.roomId)!;
  const primary = data.contract_renter.find(
    (cr) => cr.contractId === chosen.id && cr.isPrimary,
  );
  const renterRow = primary
    ? data.renter.find((r) => r.id === primary.renterId)
    : undefined;
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

/** Published, unexpired announcements for a building, newest first. `today` ends at 23:59:59 Bangkok time. */
export function loadAnnouncements(
  data: Data,
  buildingId: string,
  today: string,
): Row<'announcement'>[] {
  const now = Date.parse(`${today}T23:59:59+07:00`);
  return data.announcement
    .filter(
      (a) =>
        a.buildingId === buildingId &&
        Date.parse(a.publishedAt) <= now &&
        (a.expiresAt === null || Date.parse(a.expiresAt) > now),
    )
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function loadTenantHome(data: Data, today: string) {
  const current = tenantContract(data, today);
  if (!current) return null;
  const owed = data.invoice
    .filter(
      (i) =>
        i.contractId === current.contractId &&
        OPEN_INVOICE_STATUSES.includes(i.status),
    )
    .map((i) => ({
      id: i.id,
      number: i.number,
      dueDate: i.dueDate,
      outstanding: i.totalSatang - i.paidSatang,
    }))
    .sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
    );
  const openRepairs = data.repair_ticket.filter(
    (t) =>
      t.roomId === current.roomId && OPEN_TICKET_STATUSES.includes(t.status),
  ).length;
  return {
    ...current,
    balanceSatang: owed.reduce((sum, i) => sum + i.outstanding, 0),
    nextInvoice: owed[0] ?? null,
    openRepairs,
    announcements: loadAnnouncements(data, current.buildingId, today),
  };
}

/** Twelve months of bills and usage for the tenant's contract (mirrors `loadBills`). */
export function loadBills(data: Data, contractId: string, roomId: string) {
  const bills = data.invoice
    .filter((i) => i.contractId === contractId && i.status !== 'draft')
    .map((i) => ({
      id: i.id,
      number: i.number,
      type: i.type,
      period: i.period,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      status: i.status,
      totalSatang: i.totalSatang,
      paidSatang: i.paidSatang,
      outstandingSatang: i.totalSatang - i.paidSatang,
      lines: data.invoice_line
        .filter((l) => l.invoiceId === i.id)
        .map((l) => ({
          kind: l.kind,
          labelTh: l.labelTh,
          labelEn: l.labelEn,
          qty: l.qty,
          unitPriceSatang: l.unitPriceSatang,
          amountSatang: l.amountSatang,
        })),
    }))
    .sort(
      (a, b) =>
        b.issueDate.localeCompare(a.issueDate) || a.id.localeCompare(b.id),
    );

  const usageByPeriod = new Map<
    string,
    { electricity: number | null; water: number | null }
  >();
  for (const reading of data.meter_reading.filter((r) => r.roomId === roomId)) {
    const entry = usageByPeriod.get(reading.period) ?? {
      electricity: null,
      water: null,
    };
    if (reading.kind === 'electricity') entry.electricity = reading.unitsUsed;
    if (reading.kind === 'water') entry.water = reading.unitsUsed;
    usageByPeriod.set(reading.period, entry);
  }
  const usage = [...usageByPeriod.entries()]
    .map(([period, units]) => ({ period, ...units }))
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 12)
    .reverse();

  return { bills, usage };
}
