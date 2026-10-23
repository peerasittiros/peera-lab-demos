import { withTenant, type Queryable } from '@peera/db';
import { eq, sql } from 'drizzle-orm';
import { loadMeterRound, type MeterRoomRow } from './meters';
import { periodEnd } from '../../domain/dates';
import { ratePlanOn } from '../../domain/property';
import { building, contract, contractRenter, invoice, invoiceLine, ratePlan, renter, repairTicket, room } from '../schema';

export type OverdueInvoice = { id: string; dueDate: string; outstanding: number; alreadyCharged: boolean };

export type BillingRoom = {
  contractId: string;
  roomId: string;
  roomNumber: string;
  renterName: string | null;
  startDate: string;
  endDate: string | null;
  monthlyRent: number;
  occupants: number;
  parking: number;
  internet: number;
  electricity: MeterRoomRow | null;
  water: MeterRoomRow | null;
  previousBalance: number;
  /** Done repairs billed to the renter that are not on an invoice yet. */
  repairCharges: { ticketId: string; amount: number }[];
  overdue: OverdueInvoice[];
  /** The monthly invoice for this period, if it exists already. */
  existingInvoiceId: string | null;
};

export type ExistingInvoice = {
  id: string;
  number: string;
  contractId: string;
  roomNumber: string;
  status: string;
  type: string;
  issueDate: string;
  dueDate: string;
  subtotalSatang: number;
  totalSatang: number;
  paidSatang: number;
  publicToken: string;
  lines: { id: string; kind: string; labelTh: string; labelEn: string; amountSatang: number; meta: Record<string, unknown> }[];
};

/**
 * Everything the billing run needs for one building and month (01 §3.1 C.9): the rooms with a contract in the
 * month, their readings, the rate plan in force at the month's end, what each contract still owes, and the invoices
 * already issued for the month. Read-only.
 */
export async function loadBillingPlan(
  db: Queryable,
  tenantId: string,
  { buildingId, period, today }: { buildingId: string; period: string; today: string },
) {
  const scope = withTenant(db, tenantId);
  const periodStart = `${period}-01`;
  const monthEnd = periodEnd(period);
  const [buildingRow] = await scope.select(building, eq(building.id, buildingId));
  if (!buildingRow) return null;

  const [rooms, contracts, links, renters, plans, invoices, lateLines, electricity, water] = await Promise.all([
    scope.select(room, eq(room.buildingId, buildingId)),
    scope.select(contract),
    scope.select(contractRenter),
    scope.select(renter),
    scope.select(ratePlan, eq(ratePlan.buildingId, buildingId)),
    scope.select(invoice),
    scope.select(invoiceLine, eq(invoiceLine.kind, 'late_fee')),
    loadMeterRound(db, tenantId, { buildingId, kind: 'electricity', period }),
    loadMeterRound(db, tenantId, { buildingId, kind: 'water', period }),
  ]);

  const roomIds = new Set(rooms.map((r) => r.id));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const roomOfContract = new Map(contracts.map((c) => [c.id, c.roomId]));
  const contractRoom = (contractId: string) => roomOfContract.get(contractId) ?? '';
  const renterById = new Map(renters.map((r) => [r.id, r.name]));
  const primary = new Map(links.filter((l) => l.isPrimary).map((l) => [l.contractId, renterById.get(l.renterId) ?? null]));
  const electricityByRoom = new Map(electricity.map((r) => [r.roomId, r]));
  const waterByRoom = new Map(water.map((r) => [r.roomId, r]));
  const chargedFor = new Set(lateLines.map((l) => (l.meta as { forInvoice?: string }).forInvoice).filter(Boolean));
  const plan = ratePlanOn(plans, monthEnd);
  const oneOffLines = await scope.select(invoiceLine, eq(invoiceLine.kind, 'one_off'));
  const billedRepairs = new Set(oneOffLines.map((l) => (l.meta as { ticketId?: string }).ticketId).filter(Boolean));
  const doneRepairs = await scope.select(repairTicket, eq(repairTicket.status, 'done'));

  const billed = contracts.filter(
    (c) => roomIds.has(c.roomId) && c.startDate <= monthEnd && (c.endDate === null || c.endDate >= periodStart),
  );
  const rows: BillingRoom[] = billed
    .map((c) => {
      const r = roomById.get(c.roomId)!;
      const open = invoices.filter(
        (i) => i.contractId === c.id && (i.status === 'sent' || i.status === 'partially_paid'),
      );
      const outstanding = (i: (typeof open)[number]) => i.totalSatang - i.paidSatang;
      const existing = invoices.find((i) => i.contractId === c.id && i.period === period && i.type === 'monthly');
      const extras = (c.extras ?? {}) as { parking?: number; internet?: number };
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
        previousBalance: open.reduce((sum, i) => sum + outstanding(i), 0),
        repairCharges: doneRepairs
          .filter((t) => t.roomId === r.id && t.billToRenter && (t.costSatang ?? 0) > 0 && !billedRepairs.has(t.id))
          .map((t) => ({ ticketId: t.id, amount: t.costSatang! })),
        overdue: open
          .filter((i) => i.dueDate < today)
          .map((i) => ({
            id: i.id,
            dueDate: i.dueDate,
            outstanding: outstanding(i),
            alreadyCharged: chargedFor.has(i.id),
          })),
        existingInvoiceId: existing?.id ?? null,
      } satisfies BillingRoom;
    })
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));

  const existingInvoices = invoices.filter((i) => i.period === period && i.type === 'monthly' && roomIds.has(contractRoom(i.contractId)));
  const lines = existingInvoices.length === 0 ? [] : await scope.select(invoiceLine);
  const existing: ExistingInvoice[] = existingInvoices
    .map((i) => {
      const contractRow = contracts.find((c) => c.id === i.contractId);
      const r = contractRow ? roomById.get(contractRow.roomId) : undefined;
      return {
        id: i.id,
        number: i.number,
        contractId: i.contractId,
        roomNumber: r?.number ?? '',
        status: i.status,
        type: i.type,
        issueDate: i.issueDate,
        dueDate: i.dueDate,
        subtotalSatang: i.subtotalSatang,
        totalSatang: i.totalSatang,
        paidSatang: i.paidSatang,
        publicToken: i.publicToken,
        lines: lines
          .filter((l) => l.invoiceId === i.id)
          .map((l) => ({
            id: l.id,
            kind: l.kind,
            labelTh: l.labelTh,
            labelEn: l.labelEn,
            amountSatang: l.amountSatang,
            meta: l.meta,
          })),
      };
    })
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));

  return {
    building: buildingRow,
    plan,
    rooms: rows,
    existing,
  };
}

export type BillingPlan = NonNullable<Awaited<ReturnType<typeof loadBillingPlan>>>;

/**
 * The public invoice behind a signed link (01 §6.1). The link needs no session: `find_invoice_by_token` returns the
 * tenant and invoice ids for the token, and everything else is read inside that tenant. Drafts are never public.
 */
export async function loadPublicInvoice(db: Queryable, token: string) {
  const found = await db.execute<{ tenant_id: string; invoice_id: string }>(
    sql`select tenant_id, invoice_id from rentroll.find_invoice_by_token(${token})`,
  );
  const hit = found.rows[0];
  if (!hit) return null;
  const scope = withTenant(db, hit.tenant_id);
  const [inv] = await scope.select(invoice, eq(invoice.id, hit.invoice_id));
  if (!inv || inv.status === 'draft') return null;
  const [contractRow] = await scope.select(contract, eq(contract.id, inv.contractId));
  const [roomRow] = contractRow ? await scope.select(room, eq(room.id, contractRow.roomId)) : [];
  const [buildingRow] = await scope.select(building, eq(building.id, inv.buildingId));
  const links = contractRow ? await scope.select(contractRenter, eq(contractRenter.contractId, contractRow.id)) : [];
  const renterRows = await scope.select(renter);
  const primaryLink = links.find((l) => l.isPrimary);
  const lines = await scope.select(invoiceLine, eq(invoiceLine.invoiceId, inv.id));
  return {
    invoice: inv,
    building: buildingRow!,
    room: roomRow ?? null,
    renterName: primaryLink ? (renterRows.find((r) => r.id === primaryLink.renterId)?.name ?? null) : null,
    lines: lines.map((l) => ({
      id: l.id,
      kind: l.kind,
      labelTh: l.labelTh,
      labelEn: l.labelEn,
      amountSatang: l.amountSatang,
      meta: l.meta,
    })),
  };
}
