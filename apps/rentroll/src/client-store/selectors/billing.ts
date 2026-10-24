import { balanceOf, creditedOn } from '../settlement';
import { ratePlanOn } from '@/src/domain/property';
import { periodEnd } from '@/src/domain/dates';
import type { BillingRoom } from '@/src/domain/billing-run';
import type { LinkedInvoice } from '@/src/domain/invoice-link';
import type { Op } from '../ops';
import type { Data } from '../schema';
import { tenantContract } from './tenant';
import { meterRound } from './meters';

/**
 * Selectors for the billing run, the invoice list and the public invoice view. `billingPlan` mirrors `loadBillingPlan`
 * in `src/db/queries/billing.ts`: the same rooms, readings and rate plan, read from the store's data.
 */

const OPEN_STATUSES = ['sent', 'partially_paid'];

export function billingPlan(
  data: Data,
  buildingId: string,
  period: string,
  today: string,
) {
  const building = data.building.find((b) => b.id === buildingId);
  if (!building) return null;
  const periodStart = `${period}-01`;
  const monthEnd = periodEnd(period);

  const roomsOfBuilding = data.room.filter((r) => r.buildingId === buildingId);
  const roomIds = new Set(roomsOfBuilding.map((r) => r.id));
  const roomById = new Map(roomsOfBuilding.map((r) => [r.id, r]));
  const renterById = new Map(data.renter.map((r) => [r.id, r.name]));
  const primary = new Map(
    data.contract_renter
      .filter((l) => l.isPrimary)
      .map((l) => [l.contractId, renterById.get(l.renterId) ?? null]),
  );
  const electricityByRoom = new Map(
    meterRound(data, buildingId, 'electricity', period).map((r) => [
      r.roomId,
      r,
    ]),
  );
  const waterByRoom = new Map(
    meterRound(data, buildingId, 'water', period).map((r) => [r.roomId, r]),
  );
  const chargedFor = new Set(
    data.invoice_line
      .filter((l) => l.kind === 'late_fee')
      .map((l) => (l.meta as { forInvoice?: string }).forInvoice)
      .filter(Boolean),
  );
  const billedRepairs = new Set(
    data.invoice_line
      .filter((l) => l.kind === 'one_off')
      .map((l) => (l.meta as { ticketId?: string }).ticketId)
      .filter(Boolean),
  );
  const plan = ratePlanOn(
    data.rate_plan.filter((p) => p.buildingId === buildingId),
    monthEnd,
  );
  const doneRepairs = data.repair_ticket.filter((t) => t.status === 'done');

  const rooms: BillingRoom[] = data.contract
    .filter(
      (c) =>
        roomIds.has(c.roomId) &&
        c.startDate <= monthEnd &&
        (c.endDate === null || c.endDate >= periodStart),
    )
    .map((c) => {
      const r = roomById.get(c.roomId)!;
      const open = data.invoice.filter(
        (i) => i.contractId === c.id && OPEN_STATUSES.includes(i.status),
      );
      const existing = data.invoice.find(
        (i) =>
          i.contractId === c.id && i.period === period && i.type === 'monthly',
      );
      const extras = (c.extras ?? {}) as {
        parking?: number;
        internet?: number;
      };
      return {
        contractId: c.id,
        roomId: r.id,
        roomNumber: r.number,
        renterName: primary.get(c.id) ?? null,
        startDate: c.startDate,
        endDate: c.endDate,
        monthlyRent: c.monthlyRentSatang,
        occupants: c.occupants,
        parking: extras.parking ?? 0,
        internet: extras.internet ?? 0,
        electricity: electricityByRoom.get(r.id) ?? null,
        water: waterByRoom.get(r.id) ?? null,
        previousBalance: open.reduce((sum, i) => sum + balanceOf(data, i), 0),
        repairCharges: doneRepairs
          .filter(
            (t) =>
              t.roomId === r.id &&
              t.billToRenter &&
              (t.costSatang ?? 0) > 0 &&
              !billedRepairs.has(t.id),
          )
          .map((t) => ({ ticketId: t.id, amount: t.costSatang! })),
        overdue: open
          .filter((i) => i.dueDate < today)
          .map((i) => ({
            id: i.id,
            dueDate: i.dueDate,
            outstanding: balanceOf(data, i),
            alreadyCharged: chargedFor.has(i.id),
          })),
        existingInvoiceId: existing?.id ?? null,
      } satisfies BillingRoom;
    })
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));

  const existing = data.invoice
    .filter(
      (i) =>
        i.period === period &&
        i.type === 'monthly' &&
        roomIds.has(roomIdOf(data, i.contractId)),
    )
    .map((i) => ({
      ...i,
      roomNumber: roomById.get(roomIdOf(data, i.contractId))?.number ?? '',
      lines: data.invoice_line.filter((l) => l.invoiceId === i.id),
    }))
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));

  return { building, plan, rooms, existing };
}

function roomIdOf(data: Data, contractId: string): string {
  return data.contract.find((c) => c.id === contractId)?.roomId ?? '';
}

/** Invoices made in this session (by billing runs), as opposed to the template's. Their public links are local. */
export function visitorInvoiceIds(ops: Op[]): Set<string> {
  const ids = new Set<string>();
  for (const op of ops) {
    if (op.kind === 'billing.generate')
      for (const inv of op.payload.invoices) ids.add(inv.id);
  }
  return ids;
}

/** The invoice list: newest number first, with the room and the tenant. */
export function invoiceList(data: Data) {
  return data.invoice
    .map((i) => {
      const contract = data.contract.find((c) => c.id === i.contractId);
      const room = contract && data.room.find((r) => r.id === contract.roomId);
      const primary =
        contract &&
        data.contract_renter.find(
          (cr) => cr.contractId === contract.id && cr.isPrimary,
        );
      const renter =
        primary && data.renter.find((r) => r.id === primary.renterId);
      return {
        id: i.id,
        number: i.number,
        period: i.period,
        status: i.status,
        type: i.type,
        totalSatang: i.totalSatang,
        paidSatang: i.paidSatang,
        balanceSatang: balanceOf(data, i),
        dueDate: i.dueDate,
        publicToken: i.publicToken,
        roomNumber: room?.number ?? '',
        renterName: renter ? renter.name : null,
      };
    })
    .sort((a, b) => b.number.localeCompare(a.number));
}

/** The invoice as the printable document shows it: the building, the room, the tenant and the lines. */
export function invoiceDocument(
  data: Data,
  invoiceId: string,
): LinkedInvoice | null {
  const invoice = data.invoice.find((i) => i.id === invoiceId);
  if (!invoice) return null;
  const contract = data.contract.find((c) => c.id === invoice.contractId);
  const room = contract && data.room.find((r) => r.id === contract.roomId);
  const building = data.building.find((b) => b.id === invoice.buildingId);
  const primary =
    contract &&
    data.contract_renter.find(
      (cr) => cr.contractId === contract.id && cr.isPrimary,
    );
  const renter = primary && data.renter.find((r) => r.id === primary.renterId);
  if (!building) return null;
  return {
    number: invoice.number,
    status: invoice.status,
    period: invoice.period,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalSatang: invoice.totalSatang,
    paidSatang: invoice.paidSatang,
    creditedSatang: creditedOn(data, invoice.id),
    buildingNameTh: building.nameTh,
    buildingNameEn: building.nameEn,
    bankName: building.bankName,
    bankAccountMasked: building.bankAccountMasked,
    roomNumber: room?.number ?? '',
    renterName: renter ? renter.name : null,
    lines: data.invoice_line
      .filter((l) => l.invoiceId === invoice.id)
      .map((l) => ({
        id: l.id,
        labelTh: l.labelTh,
        labelEn: l.labelEn,
        amountSatang: l.amountSatang,
        meta: l.meta,
      })),
  };
}

/** The next free invoice sequence for a building, year and type (the `doc_sequence` row, or 1). */
export function nextSequence(
  data: Data,
  buildingId: string,
  docType: string,
  year: number,
): number {
  return (
    data.doc_sequence.find(
      (s) =>
        s.buildingId === buildingId && s.docType === docType && s.year === year,
    )?.nextNo ?? 1
  );
}

/** One of the tenant's bills, with its lines and the receipts that settled it. Null when it is not on their contract. */
export function tenantBill(data: Data, invoiceId: string, today: string) {
  const current = tenantContract(data, today);
  const invoice = data.invoice.find((i) => i.id === invoiceId);
  if (
    !current ||
    !invoice ||
    invoice.contractId !== current.contractId ||
    invoice.status === 'draft'
  )
    return null;
  const lines = data.invoice_line.filter((l) => l.invoiceId === invoice.id);
  const receipts = data.payment_allocation
    .filter((a) => a.invoiceId === invoice.id)
    .map((a) => data.payment.find((p) => p.id === a.paymentId))
    .filter((p): p is NonNullable<typeof p> =>
      Boolean(p && p.status === 'approved' && p.receiptNumber),
    )
    .map((p) => ({
      paymentId: p.id,
      receiptNumber: p.receiptNumber!,
      amountSatang: p.amountSatang,
    }));
  return { invoice, lines, receipts, data };
}
