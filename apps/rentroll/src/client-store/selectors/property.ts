import { dayNumber } from '@/src/domain/dates';
import { moveInInvoice } from '@/src/domain/move';
import { moveOutSettlement } from '@/src/domain/move';
import {
  ratePlanOn,
  roomStatus,
  isLiveContract,
  type RoomStatus,
} from '@/src/domain/property';
import { ratesOf } from '@/src/domain/billing-run';
import { readingHistory } from './meters';
import type { Data } from '../schema';
import type { Op } from '../ops';

/**
 * Selectors for the property screens (SPEC §4 O2–O8, O5): the room map and room detail, the room-type comparison,
 * buildings and rates, tenants, contracts, and the move-in and move-out previews. Pure, from the store's data.
 */

const OPEN_INVOICE_STATUSES = ['sent', 'partially_paid'];

/** The contract that is live today for a room, if any (the one that makes the room occupied or reserved). */
export function liveContractOf(data: Data, roomId: string, today: string) {
  return (
    data.contract.find(
      (c) => c.roomId === roomId && isLiveContract(c, today),
    ) ?? null
  );
}

function primaryRenterName(data: Data, contractId: string): string | null {
  const link = data.contract_renter.find(
    (cr) => cr.contractId === contractId && cr.isPrimary,
  );
  if (!link) return null;
  return data.renter.find((r) => r.id === link.renterId)?.name ?? null;
}

/** The most days any open invoice of the contract is past due (0 when none is). */
function daysPastDue(data: Data, contractId: string, today: string): number {
  const overdue = data.invoice.filter(
    (i) =>
      i.contractId === contractId &&
      OPEN_INVOICE_STATUSES.includes(i.status) &&
      i.dueDate < today,
  );
  return overdue.reduce(
    (most, i) => Math.max(most, dayNumber(today) - dayNumber(i.dueDate)),
    0,
  );
}

export type RoomRow = {
  roomId: string;
  number: string;
  floor: number;
  sort: number;
  maintenance: boolean;
  typeName: string | null;
  rent: number | null;
  status: RoomStatus;
  renterName: string | null;
  contractId: string | null;
  daysPastDue: number;
  notice: boolean;
};

/** Every room of a building for the room map, in walking order. */
export function roomMap(
  data: Data,
  buildingId: string,
  today: string,
): RoomRow[] {
  return data.room
    .filter((r) => r.buildingId === buildingId)
    .map((r): RoomRow => {
      const contracts = data.contract.filter((c) => c.roomId === r.id);
      const live = liveContractOf(data, r.id, today);
      const type = data.room_type.find((t) => t.id === r.roomTypeId);
      return {
        roomId: r.id,
        number: r.number,
        floor: r.floor,
        sort: r.sort,
        maintenance: r.maintenance,
        typeName: type ? type.nameEn : null,
        rent: type ? type.monthlyRentSatang : null,
        status: roomStatus({ maintenance: r.maintenance, contracts, today }),
        renterName: live ? primaryRenterName(data, live.id) : null,
        contractId: live?.id ?? null,
        daysPastDue: live ? daysPastDue(data, live.id, today) : 0,
        notice: live?.status === 'notice_given',
      };
    })
    .sort(
      (a, b) =>
        a.floor - b.floor ||
        a.sort - b.sort ||
        a.number.localeCompare(b.number),
    );
}

/** A room's detail: its contract and renter, the last six bills, and its meter history. */
export function roomDetail(data: Data, roomId: string, today: string) {
  const room = data.room.find((r) => r.id === roomId);
  if (!room) return null;
  const building = data.building.find((b) => b.id === room.buildingId);
  const type = data.room_type.find((t) => t.id === room.roomTypeId);
  const contracts = data.contract.filter((c) => c.roomId === roomId);
  const live = liveContractOf(data, roomId, today);
  const bills = live
    ? data.invoice
        .filter((i) => i.contractId === live.id && i.status !== 'draft')
        .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
        .slice(0, 6)
    : [];
  const readings = (kind: 'electricity' | 'water') =>
    data.meter_reading
      .filter((m) => m.roomId === roomId && m.kind === kind)
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 12)
      .map((m) => ({
        period: m.period,
        reading: m.reading,
        unitsUsed: m.unitsUsed,
      }));
  return {
    room,
    buildingName: building ? (building.nameEn ?? building.nameTh) : '',
    buildingNameTh: building?.nameTh ?? '',
    typeName: type ? type.nameEn : null,
    status: roomStatus({ maintenance: room.maintenance, contracts, today }),
    contract: live
      ? {
          id: live.id,
          startDate: live.startDate,
          endDate: live.endDate,
          status: live.status,
          renterName: primaryRenterName(data, live.id),
        }
      : null,
    bills,
    electricity: readings('electricity'),
    water: readings('water'),
  };
}

/** Room types for a building, side by side: rent, deposit, advance, size, the move-in total, and free rooms. */
export function roomTypeComparison(
  data: Data,
  buildingId: string,
  today: string,
) {
  return data.room_type
    .filter((t) => t.buildingId === buildingId)
    .map((t) => {
      const rooms = data.room.filter((r) => r.roomTypeId === t.id);
      const free = rooms.filter(
        (r) =>
          roomStatus({
            maintenance: r.maintenance,
            contracts: data.contract.filter((c) => c.roomId === r.id),
            today,
          }) === 'vacant',
      );
      return {
        id: t.id,
        nameTh: t.nameTh,
        nameEn: t.nameEn,
        monthlyRentSatang: t.monthlyRentSatang,
        depositSatang: t.depositSatang,
        advanceMonths: t.advanceMonths,
        sizeSqm: rooms[0]?.sizeSqm ?? null,
        moveInTotalSatang:
          t.monthlyRentSatang +
          t.depositSatang +
          t.advanceMonths * t.monthlyRentSatang,
        roomsTotal: rooms.length,
        roomsFree: free.length,
      };
    });
}

/** Buildings with their rate plans, the plan in force today first. */
export function buildingsWithRates(data: Data, today: string) {
  return data.building.map((b) => {
    const plans = data.rate_plan
      .filter((p) => p.buildingId === b.id)
      .sort((a, c) => c.validFrom.localeCompare(a.validFrom));
    return { building: b, plans, current: ratePlanOn(plans, today) };
  });
}

/** Renters with their current room, filtered by name in the caller. */
export function tenantsList(data: Data, today: string) {
  return data.renter
    .map((r) => {
      const link = data.contract_renter.find((cr) => cr.renterId === r.id);
      const contract =
        link &&
        data.contract.find(
          (c) => c.id === link.contractId && isLiveContract(c, today),
        );
      const room = contract && data.room.find((x) => x.id === contract.roomId);
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        roomNumber: room?.number ?? null,
        contractId: contract?.id ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Contracts with room and renter, newest first. */
export function contractsList(data: Data) {
  return data.contract
    .map((c) => {
      const room = data.room.find((r) => r.id === c.roomId);
      return {
        id: c.id,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        monthlyRentSatang: c.monthlyRentSatang,
        roomNumber: room?.number ?? '',
        renterName: primaryRenterName(data, c.id),
      };
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/** One contract with everything its screen shows. */
export function contractDetail(data: Data, contractId: string) {
  const contract = data.contract.find((c) => c.id === contractId);
  if (!contract) return null;
  const room = data.room.find((r) => r.id === contract.roomId);
  const renters = data.contract_renter
    .filter((cr) => cr.contractId === contractId)
    .map((cr) => ({
      name: data.renter.find((r) => r.id === cr.renterId)?.name ?? '',
      isPrimary: cr.isPrimary,
    }));
  return {
    contract,
    roomNumber: room?.number ?? '',
    renters,
    invoices: data.invoice
      .filter((i) => i.contractId === contractId)
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate)),
    checklists: data.checklist.filter((c) => c.contractId === contractId),
    settlement:
      data.settlement.find((s) => s.contractId === contractId) ?? null,
  };
}

/** The first invoice of a new contract, worked out before the owner confirms it. */
export function moveInPreview(input: {
  monthlyRentSatang: number;
  startDate: string;
  depositSatang: number;
  advanceMonths: number;
}) {
  return moveInInvoice({
    monthlyRent: input.monthlyRentSatang,
    startDate: input.startDate,
    period: input.startDate.slice(0, 7),
    deposit: input.depositSatang,
    advanceMonths: input.advanceMonths,
  });
}

export type MoveOutInput = {
  contractId: string;
  moveOutDate: string;
  elecReading: number;
  waterReading: number;
  elecRollover: boolean;
  waterRollover: boolean;
  damages: number;
  cleaningFee: number;
};

/** The move-out settlement from the final readings. Null when the contract or its rate plan or meters are missing. */
export function moveOutPreview(data: Data, input: MoveOutInput) {
  const contract = data.contract.find((c) => c.id === input.contractId);
  const room = contract && data.room.find((r) => r.id === contract.roomId);
  if (!contract || !room) return null;
  const plan = ratePlanOn(
    data.rate_plan.filter((p) => p.buildingId === room.buildingId),
    input.moveOutDate,
  );
  if (!plan) return null;
  const rates = ratesOf(plan);
  const elecHistory = readingHistory(data, room.id, 'electricity').filter(
    (h) => h.period < input.moveOutDate.slice(0, 7),
  );
  const waterHistory = readingHistory(data, room.id, 'water').filter(
    (h) => h.period < input.moveOutDate.slice(0, 7),
  );
  const lastElec = elecHistory
    .sort((a, b) => a.period.localeCompare(b.period))
    .at(-1);
  const lastWater = waterHistory
    .sort((a, b) => a.period.localeCompare(b.period))
    .at(-1);
  if (!lastElec || !lastWater) return null;
  const unpaid = data.invoice
    .filter(
      (i) =>
        i.contractId === contract.id &&
        OPEN_INVOICE_STATUSES.includes(i.status),
    )
    .reduce((sum, i) => sum + (i.totalSatang - i.paidSatang), 0);
  try {
    const result = moveOutSettlement({
      elec: {
        previous: lastElec.reading,
        current: input.elecReading,
        meterDigits: room.elecMeterDigits,
        rollover: input.elecRollover,
        rate: rates.elec,
      },
      water: {
        previous: lastWater.reading,
        current: input.waterReading,
        meterDigits: room.waterMeterDigits,
        rollover: input.waterRollover,
        rate: rates.water,
        occupants: contract.occupants,
      },
      unpaid,
      deposit: contract.depositReceivedSatang,
      damages: input.damages,
      cleaningFee: input.cleaningFee,
    });
    return { contract, room, result, lastElec, lastWater, unpaid };
  } catch {
    return null;
  }
}

/** The ops that touched a room's meters, as history for the feed (kept for the detail page's timeline). */
export function opsFor(ops: Op[], kind: Op['kind']) {
  return ops.filter((op) => op.kind === kind);
}
