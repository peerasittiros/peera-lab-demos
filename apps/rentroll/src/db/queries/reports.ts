import { withTenant, type Queryable } from '@peera/db';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { addMonths } from '../../domain/dates';
import { roomStatus, type RoomStatus } from '../../domain/property';
import { loadMeterRound } from './meters';
import { loadProperty } from './property';
import { building, contract, contractRenter, invoice, invoiceLine, payment, renter, repairTicket, room, settlement } from '../schema';

/** Monthly invoices of a period, not void: the money that period billed. */
async function periodInvoices(db: Queryable, tenantId: string, period: string) {
  const scope = withTenant(db, tenantId);
  return scope.select(
    invoice,
    and(eq(invoice.period, period), eq(invoice.type, 'monthly'), ne(invoice.status, 'void')),
  );
}

export type RentRollRow = {
  roomNumber: string;
  renterName: string | null;
  status: RoomStatus;
  rentSatang: number;
  utilitiesSatang: number;
  billedSatang: number;
  paidSatang: number;
  outstandingSatang: number;
};

/**
 * The monthly rent roll (01 §3.1 G.21): every room with its tenant, rent, utilities, what the month billed, what is
 * paid and what is still owed. Totals are sums of the invoices of the month, not of these rows (the test checks it).
 */
export async function loadRentRoll(db: Queryable, tenantId: string, period: string, today: string): Promise<RentRollRow[]> {
  const scope = withTenant(db, tenantId);
  const [{ rooms }, contracts, links, renters, invoices, lines] = await Promise.all([
    loadProperty(db, tenantId, today),
    scope.select(contract),
    scope.select(contractRenter),
    scope.select(renter),
    periodInvoices(db, tenantId, period),
    scope.select(invoiceLine),
  ]);
  const renterName = new Map(renters.map((r) => [r.id, r.name]));
  const primary = new Map(links.filter((l) => l.isPrimary).map((l) => [l.contractId, renterName.get(l.renterId) ?? null]));
  const roomOfContract = new Map(contracts.map((c) => [c.id, c.roomId]));
  const invoiceByRoom = new Map<string, (typeof invoices)[number]>();
  for (const i of invoices) {
    const roomId = roomOfContract.get(i.contractId);
    if (roomId) invoiceByRoom.set(roomId, i);
  }
  const utilitiesOf = (invoiceId: string) =>
    lines
      .filter((l) => l.invoiceId === invoiceId && (l.kind === 'electricity' || l.kind === 'water'))
      .reduce((sum, l) => sum + l.amountSatang, 0);
  return rooms.map((r) => {
    const current = contracts.find((c) => c.roomId === r.id && (c.status === 'active' || c.status === 'notice_given'));
    const inv = invoiceByRoom.get(r.id);
    return {
      roomNumber: r.number,
      renterName: current ? (primary.get(current.id) ?? null) : null,
      status: roomStatus({ maintenance: r.maintenance, contracts: contracts.filter((c) => c.roomId === r.id), today }),
      rentSatang: current?.monthlyRentSatang ?? 0,
      utilitiesSatang: inv ? utilitiesOf(inv.id) : 0,
      billedSatang: inv?.totalSatang ?? 0,
      paidSatang: inv?.paidSatang ?? 0,
      outstandingSatang: inv ? inv.totalSatang - inv.paidSatang : 0,
    };
  });
}

export type UtilityRow = { roomNumber: string; electricityUnits: number; electricitySatang: number; waterUnits: number; waterSatang: number };

/** Units and amounts per room for the month, from the invoice lines (01 §3.1 G.21 "Utilities report"). */
export async function loadUtilitiesReport(db: Queryable, tenantId: string, period: string): Promise<UtilityRow[]> {
  const scope = withTenant(db, tenantId);
  const [contracts, rooms, invoices, lines] = await Promise.all([
    scope.select(contract),
    scope.select(room),
    periodInvoices(db, tenantId, period),
    scope.select(invoiceLine),
  ]);
  const roomOfContract = new Map(contracts.map((c) => [c.id, c.roomId]));
  const roomNumber = new Map(rooms.map((r) => [r.id, r.number]));
  const rows = new Map<string, UtilityRow>();
  for (const inv of invoices) {
    const roomId = roomOfContract.get(inv.contractId);
    if (!roomId) continue;
    const row = rows.get(roomId) ?? { roomNumber: roomNumber.get(roomId) ?? '', electricityUnits: 0, electricitySatang: 0, waterUnits: 0, waterSatang: 0 };
    for (const line of lines.filter((l) => l.invoiceId === inv.id)) {
      const units = Number((line.meta as { units?: number }).units ?? 0);
      if (line.kind === 'electricity') {
        row.electricityUnits += units;
        row.electricitySatang += line.amountSatang;
      }
      if (line.kind === 'water') {
        row.waterUnits += units;
        row.waterSatang += line.amountSatang;
      }
    }
    rows.set(roomId, row);
  }
  return [...rows.values()].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
}

export type DepositRow = {
  roomNumber: string;
  renterName: string | null;
  depositSatang: number;
  receivedSatang: number;
  settled: boolean;
  refundSatang: number | null;
};

/** Deposits held per contract, and the refund for contracts already settled (01 §3.1 G.21 "Deposit ledger"). */
export async function loadDepositsReport(db: Queryable, tenantId: string): Promise<DepositRow[]> {
  const scope = withTenant(db, tenantId);
  const [contracts, rooms, links, renters, settlements] = await Promise.all([
    scope.select(contract),
    scope.select(room),
    scope.select(contractRenter),
    scope.select(renter),
    scope.select(settlement),
  ]);
  const roomNumber = new Map(rooms.map((r) => [r.id, r.number]));
  const renterName = new Map(renters.map((r) => [r.id, r.name]));
  const primary = new Map(links.filter((l) => l.isPrimary).map((l) => [l.contractId, renterName.get(l.renterId) ?? null]));
  const settled = new Map(settlements.map((s) => [s.contractId, s.refundSatang]));
  return contracts
    .filter((c) => c.depositSatang > 0 || c.depositReceivedSatang > 0)
    .map((c) => ({
      roomNumber: roomNumber.get(c.roomId) ?? '',
      renterName: primary.get(c.id) ?? null,
      depositSatang: c.depositSatang,
      receivedSatang: c.depositReceivedSatang,
      settled: settled.has(c.id),
      refundSatang: settled.get(c.id) ?? null,
    }))
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

/**
 * The owner's dashboard (01 §3.1 F.18–19, §8 screen 1). Every figure is a sum over the same rows the reports use, so
 * a KPI and its report total cannot disagree.
 */
export async function loadDashboard(db: Queryable, tenantId: string, period: string, today: string) {
  const scope = withTenant(db, tenantId);
  const property = await loadProperty(db, tenantId, today);
  const rentable = property.rooms.filter((r) => !r.maintenance);
  const occupied = rentable.filter((r) => r.status === 'occupied').length;

  const billedNow = await periodInvoices(db, tenantId, period);
  const billed = billedNow.reduce((sum, i) => sum + i.totalSatang, 0);
  const collected = billedNow.reduce((sum, i) => sum + i.paidSatang, 0);

  const open = await scope.select(invoice, inArray(invoice.status, ['sent', 'partially_paid']));
  const outstanding = open.reduce((sum, i) => sum + (i.totalSatang - i.paidSatang), 0);
  const overdue = open.filter((i) => i.dueDate < today);

  const contracts = await scope.select(contract);
  const notices = contracts.filter((c) => c.status === 'notice_given');
  const repairs = await scope.select(repairTicket, inArray(repairTicket.status, ['new', 'scheduled', 'in_progress']));
  const pendingSlips = await scope.select(payment, eq(payment.status, 'pending_review'));

  // Twelve months ending with `period`: rent against utilities, and the collection rate per month.
  const allInvoices = await scope.select(invoice);
  const lines = await scope.select(invoiceLine);
  const revenue = Array.from({ length: 12 }, (_, k) => addMonths(period, k - 11)).map((p) => {
    const monthly = allInvoices.filter((i) => i.period === p && i.type === 'monthly' && i.status !== 'void');
    const ids = new Set(monthly.map((i) => i.id));
    const lineSums = lines.filter((l) => ids.has(l.invoiceId));
    const rent = lineSums.filter((l) => l.kind === 'rent').reduce((s, l) => s + l.amountSatang, 0);
    const utilities = lineSums.filter((l) => l.kind === 'electricity' || l.kind === 'water').reduce((s, l) => s + l.amountSatang, 0);
    const total = monthly.reduce((s, i) => s + i.totalSatang, 0);
    const paid = monthly.reduce((s, i) => s + i.paidSatang, 0);
    return { period: p, rentSatang: rent, utilitiesSatang: utilities, billedSatang: total, paidSatang: paid, collectionRate: total === 0 ? null : paid / total };
  });

  // Usage by building for the period: electricity and water units per building.
  const buildings = await scope.select(building);
  const roomBuilding = new Map(property.rooms.map((r) => [r.id, r.buildingId]));
  const contractRoom = new Map(contracts.map((c) => [c.id, c.roomId]));
  const usage = buildings.map((b) => {
    const monthly = billedNow.filter((i) => roomBuilding.get(contractRoom.get(i.contractId) ?? '') === b.id);
    const ids = new Set(monthly.map((i) => i.id));
    const sumUnits = (kind: string) =>
      lines
        .filter((l) => ids.has(l.invoiceId) && l.kind === kind)
        .reduce((s, l) => s + Number((l.meta as { units?: number }).units ?? 0), 0);
    return { buildingName: b.nameTh, electricityUnits: sumUnits('electricity'), waterUnits: sumUnits('water') };
  });

  // Vacancy: days since the last contract on each vacant room ended.
  const vacancy = property.rooms
    .filter((r) => r.status === 'vacant')
    .map((r) => {
      const ended = contracts
        .filter((c) => c.roomId === r.id && c.endDate !== null && c.endDate <= today)
        .map((c) => c.endDate!)
        .sort()
        .at(-1);
      return {
        roomNumber: r.number,
        days: ended ? Math.round((Date.parse(today) - Date.parse(ended)) / 86_400_000) : null,
      };
    });

  // To do: meters still to read this month, slips to review, notices, overdue, repairs.
  let metersMissing = 0;
  for (const b of buildings) {
    const round = await loadMeterRound(db, tenantId, { buildingId: b.id, kind: 'electricity', period });
    metersMissing += round.filter((r) => r.current === null && property.rooms.find((p) => p.id === r.roomId)?.status === 'occupied').length;
  }

  return {
    period,
    kpis: {
      occupied,
      rentable: rentable.length,
      occupancy: rentable.length === 0 ? null : occupied / rentable.length,
      billedSatang: billed,
      collectedSatang: collected,
      outstandingSatang: outstanding,
      overdueCount: overdue.length,
      overdueSatang: overdue.reduce((s, i) => s + (i.totalSatang - i.paidSatang), 0),
      moveOuts30: notices.length,
      openRepairs: repairs.length,
    },
    revenue,
    usage,
    vacancy,
    todo: {
      metersMissing,
      slipsWaiting: pendingSlips.length,
      noticesOpen: notices.length,
      overdueCount: overdue.length,
      openRepairs: repairs.length,
    },
  };
}

