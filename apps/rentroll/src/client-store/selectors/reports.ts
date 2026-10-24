import { addMonths } from '@/src/domain/dates';
import { roomStatus, type RoomStatus } from '@/src/domain/property';
import { meterRound } from './meters';
import type { Data } from '../schema';

/**
 * Selectors for the dashboard and the three reports (SPEC §4 O1, O17). Each mirrors a function in
 * `src/db/queries/reports.ts`: the same rows, read from the store's data. Every figure is a sum over the same rows the
 * reports use, so a KPI and its report total cannot disagree.
 */

const OPEN_STATUSES = ['sent', 'partially_paid'];

/** Monthly invoices of a period, not void: the money that period billed. */
function periodInvoices(data: Data, period: string) {
  return data.invoice.filter(
    (i) => i.period === period && i.type === 'monthly' && i.status !== 'void',
  );
}

function statusOf(data: Data, roomId: string, today: string): RoomStatus {
  const room = data.room.find((r) => r.id === roomId)!;
  return roomStatus({
    maintenance: room.maintenance,
    contracts: data.contract.filter((c) => c.roomId === roomId),
    today,
  });
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

/** The monthly rent roll: every room with its tenant, rent, utilities, the month's billing and what is owed. */
export function rentRoll(
  data: Data,
  period: string,
  today: string,
): RentRollRow[] {
  const invoices = periodInvoices(data, period);
  const renterName = new Map(data.renter.map((r) => [r.id, r.name]));
  const primary = new Map(
    data.contract_renter
      .filter((l) => l.isPrimary)
      .map((l) => [l.contractId, renterName.get(l.renterId) ?? null]),
  );
  const roomOfContract = new Map(data.contract.map((c) => [c.id, c.roomId]));
  const invoiceByRoom = new Map<string, (typeof invoices)[number]>();
  for (const i of invoices) {
    const roomId = roomOfContract.get(i.contractId);
    if (roomId) invoiceByRoom.set(roomId, i);
  }
  const utilitiesOf = (invoiceId: string) =>
    data.invoice_line
      .filter(
        (l) =>
          l.invoiceId === invoiceId &&
          (l.kind === 'electricity' || l.kind === 'water'),
      )
      .reduce((sum, l) => sum + l.amountSatang, 0);
  return data.room
    .map((r) => {
      const current = data.contract.find(
        (c) =>
          c.roomId === r.id &&
          (c.status === 'active' || c.status === 'notice_given'),
      );
      const inv = invoiceByRoom.get(r.id);
      return {
        roomNumber: r.number,
        renterName: current ? (primary.get(current.id) ?? null) : null,
        status: statusOf(data, r.id, today),
        rentSatang: current?.monthlyRentSatang ?? 0,
        utilitiesSatang: inv ? utilitiesOf(inv.id) : 0,
        billedSatang: inv?.totalSatang ?? 0,
        paidSatang: inv?.paidSatang ?? 0,
        outstandingSatang: inv ? inv.totalSatang - inv.paidSatang : 0,
      };
    })
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
}

export type UtilityRow = {
  roomNumber: string;
  electricityUnits: number;
  electricitySatang: number;
  waterUnits: number;
  waterSatang: number;
};

/** Units and amounts per room for the month, from the invoice lines. */
export function utilitiesReport(data: Data, period: string): UtilityRow[] {
  const roomOfContract = new Map(data.contract.map((c) => [c.id, c.roomId]));
  const roomNumber = new Map(data.room.map((r) => [r.id, r.number]));
  const rows = new Map<string, UtilityRow>();
  for (const inv of periodInvoices(data, period)) {
    const roomId = roomOfContract.get(inv.contractId);
    if (!roomId) continue;
    const row = rows.get(roomId) ?? {
      roomNumber: roomNumber.get(roomId) ?? '',
      electricityUnits: 0,
      electricitySatang: 0,
      waterUnits: 0,
      waterSatang: 0,
    };
    for (const line of data.invoice_line.filter(
      (l) => l.invoiceId === inv.id,
    )) {
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
  return [...rows.values()].sort((a, b) =>
    a.roomNumber.localeCompare(b.roomNumber),
  );
}

export type DepositRow = {
  roomNumber: string;
  renterName: string | null;
  depositSatang: number;
  receivedSatang: number;
  settled: boolean;
  refundSatang: number | null;
};

/** Deposits per contract, and the refund for contracts already settled. */
export function depositsReport(data: Data): DepositRow[] {
  const roomNumber = new Map(data.room.map((r) => [r.id, r.number]));
  const renterName = new Map(data.renter.map((r) => [r.id, r.name]));
  const primary = new Map(
    data.contract_renter
      .filter((l) => l.isPrimary)
      .map((l) => [l.contractId, renterName.get(l.renterId) ?? null]),
  );
  const settled = new Map(
    data.settlement.map((s) => [s.contractId, s.refundSatang]),
  );
  return data.contract
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

/** The owner's dashboard for a month. Same shape as the server's `loadDashboard`. */
export function dashboard(data: Data, period: string, today: string) {
  const rooms = data.room.map((r) => ({
    id: r.id,
    buildingId: r.buildingId,
    number: r.number,
    status: statusOf(data, r.id, today),
  }));
  const rentable = rooms.filter(
    (r) => !data.room.find((x) => x.id === r.id)!.maintenance,
  );
  const occupied = rentable.filter((r) => r.status === 'occupied').length;

  const billedNow = periodInvoices(data, period);
  const billed = billedNow.reduce((sum, i) => sum + i.totalSatang, 0);
  const collected = billedNow.reduce((sum, i) => sum + i.paidSatang, 0);

  const open = data.invoice.filter((i) => OPEN_STATUSES.includes(i.status));
  const outstanding = open.reduce(
    (sum, i) => sum + (i.totalSatang - i.paidSatang),
    0,
  );
  const overdue = open.filter((i) => i.dueDate < today);

  const notices = data.contract.filter((c) => c.status === 'notice_given');
  const repairs = data.repair_ticket.filter((t) =>
    ['new', 'scheduled', 'in_progress'].includes(t.status),
  );
  const pendingSlips = data.payment.filter(
    (p) => p.status === 'pending_review',
  );

  const revenue = Array.from({ length: 12 }, (_, k) =>
    addMonths(period, k - 11),
  ).map((p) => {
    const monthly = periodInvoices(data, p);
    const ids = new Set(monthly.map((i) => i.id));
    const lines = data.invoice_line.filter((l) => ids.has(l.invoiceId));
    const rent = lines
      .filter((l) => l.kind === 'rent')
      .reduce((s, l) => s + l.amountSatang, 0);
    const utilities = lines
      .filter((l) => l.kind === 'electricity' || l.kind === 'water')
      .reduce((s, l) => s + l.amountSatang, 0);
    const total = monthly.reduce((s, i) => s + i.totalSatang, 0);
    const paid = monthly.reduce((s, i) => s + i.paidSatang, 0);
    return {
      period: p,
      rentSatang: rent,
      utilitiesSatang: utilities,
      billedSatang: total,
      paidSatang: paid,
      collectionRate: total === 0 ? null : paid / total,
    };
  });

  const roomBuilding = new Map(data.room.map((r) => [r.id, r.buildingId]));
  const roomOfContract = new Map(data.contract.map((c) => [c.id, c.roomId]));
  const usage = data.building.map((b) => {
    const ids = new Set(
      billedNow
        .filter(
          (i) =>
            roomBuilding.get(roomOfContract.get(i.contractId) ?? '') === b.id,
        )
        .map((i) => i.id),
    );
    const sumUnits = (kind: string) =>
      data.invoice_line
        .filter((l) => ids.has(l.invoiceId) && l.kind === kind)
        .reduce(
          (s, l) => s + Number((l.meta as { units?: number }).units ?? 0),
          0,
        );
    return {
      buildingName: b.nameTh,
      electricityUnits: sumUnits('electricity'),
      waterUnits: sumUnits('water'),
    };
  });

  const vacancy = rooms
    .filter((r) => r.status === 'vacant')
    .map((r) => {
      const ended = data.contract
        .filter(
          (c) => c.roomId === r.id && c.endDate !== null && c.endDate <= today,
        )
        .map((c) => c.endDate!)
        .sort()
        .at(-1);
      return {
        roomNumber: r.number,
        days: ended
          ? Math.round((Date.parse(today) - Date.parse(ended)) / 86_400_000)
          : null,
      };
    });

  let metersMissing = 0;
  for (const b of data.building) {
    const round = meterRound(data, b.id, 'electricity', period);
    metersMissing += round.filter(
      (r) =>
        r.current === null &&
        rooms.find((p) => p.id === r.roomId)?.status === 'occupied',
    ).length;
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
      overdueSatang: overdue.reduce(
        (s, i) => s + (i.totalSatang - i.paidSatang),
        0,
      ),
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
