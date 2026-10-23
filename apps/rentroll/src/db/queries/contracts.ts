import { withTenant, type Queryable } from '@peera/db';
import { and, desc, eq } from 'drizzle-orm';
import { isLiveContract, roomStatus, ratePlanOn, type RoomStatus } from '../../domain/property';
import {
  building,
  checklist,
  contract,
  contractRenter,
  invoice,
  invoiceLine,
  meterReading,
  ratePlan,
  renter,
  room,
  roomType,
  settlement,
} from '../schema';

export type ContractListRow = {
  id: string;
  roomId: string;
  roomNumber: string;
  buildingId: string;
  status: string;
  startDate: string;
  endDate: string | null;
  noticeDate: string | null;
  renterName: string | null;
  monthlyRentSatang: number;
};

/** Every contract of the tenant, newest first, with the room and primary renter. */
export async function loadContracts(db: Queryable, tenantId: string): Promise<ContractListRow[]> {
  const scope = withTenant(db, tenantId);
  const [contracts, rooms, links, renters] = await Promise.all([
    scope.select(contract),
    scope.select(room),
    scope.select(contractRenter),
    scope.select(renter),
  ]);
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const nameById = new Map(renters.map((r) => [r.id, r.name]));
  const primary = new Map(links.filter((l) => l.isPrimary).map((l) => [l.contractId, nameById.get(l.renterId) ?? null]));
  return contracts
    .map((c) => ({
      id: c.id,
      roomId: c.roomId,
      roomNumber: roomById.get(c.roomId)?.number ?? '',
      buildingId: roomById.get(c.roomId)?.buildingId ?? '',
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      noticeDate: c.noticeDate,
      renterName: primary.get(c.id) ?? null,
      monthlyRentSatang: c.monthlyRentSatang,
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.roomNumber.localeCompare(b.roomNumber));
}

export type RenterListRow = {
  id: string;
  name: string;
  phone: string | null;
  emergencyContact: { name: string; phone: string } | null;
  /** Room number of a live contract, if any. */
  roomNumber: string | null;
};

export async function loadRenters(db: Queryable, tenantId: string, today: string): Promise<RenterListRow[]> {
  const scope = withTenant(db, tenantId);
  const [renters, links, contracts, rooms] = await Promise.all([
    scope.select(renter),
    scope.select(contractRenter),
    scope.select(contract),
    scope.select(room),
  ]);
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  return renters
    .map((r) => {
      const live = links
        .filter((l) => l.renterId === r.id)
        .map((l) => contractById.get(l.contractId))
        .find((c) => c && isLiveContract(c, today));
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        emergencyContact: r.emergencyContact ?? null,
        roomNumber: live ? (roomById.get(live.roomId)?.number ?? null) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type ContractDetail = {
  contract: typeof contract.$inferSelect;
  roomNumber: string;
  roomId: string;
  buildingId: string;
  buildingNameTh: string;
  buildingNameEn: string | null;
  renters: { id: string; name: string; phone: string | null; isPrimary: boolean }[];
  invoices: {
    id: string;
    number: string;
    type: string;
    period: string | null;
    dueDate: string;
    status: string;
    totalSatang: number;
    paidSatang: number;
  }[];
  checklists: { kind: string; items: { key: string; labelTh: string; labelEn: string; status: string | null }[] }[];
  settlement: typeof settlement.$inferSelect | null;
  status: RoomStatus;
};

export async function loadContractDetail(
  db: Queryable,
  tenantId: string,
  contractId: string,
  today: string,
): Promise<ContractDetail | null> {
  const scope = withTenant(db, tenantId);
  const [found] = await scope.select(contract, eq(contract.id, contractId));
  if (!found) return null;
  const [roomRow] = await scope.select(room, eq(room.id, found.roomId));
  const [buildingRow] = await scope.select(building, eq(building.id, roomRow!.buildingId));
  const [links, renters, invoices, checklists, settlements, siblings] = await Promise.all([
    scope.select(contractRenter, eq(contractRenter.contractId, contractId)),
    scope.select(renter),
    scope.select(invoice, eq(invoice.contractId, contractId)),
    scope.select(checklist, eq(checklist.contractId, contractId)),
    scope.select(settlement, eq(settlement.contractId, contractId)),
    scope.select(contract, eq(contract.roomId, roomRow!.id)),
  ]);
  const renterById = new Map(renters.map((r) => [r.id, r]));
  const status = roomStatus({ maintenance: roomRow!.maintenance, contracts: siblings, today });
  return {
    contract: found,
    roomNumber: roomRow!.number,
    roomId: roomRow!.id,
    buildingId: buildingRow!.id,
    buildingNameTh: buildingRow!.nameTh,
    buildingNameEn: buildingRow!.nameEn,
    renters: links.flatMap((l) => {
      const r = renterById.get(l.renterId);
      return r ? [{ id: r.id, name: r.name, phone: r.phone, isPrimary: l.isPrimary }] : [];
    }),
    invoices: invoices
      .map((i) => ({
        id: i.id,
        number: i.number,
        type: i.type,
        period: i.period,
        dueDate: i.dueDate,
        status: i.status,
        totalSatang: i.totalSatang,
        paidSatang: i.paidSatang,
      }))
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    checklists: checklists.map((c) => ({ kind: c.kind, items: c.items })),
    settlement: settlements[0] ?? null,
    status,
  };
}

/**
 * What a move-out needs beyond the form: the last readings of each meter, the rate plan in force on the move-out
 * date, the unpaid balance, and the move-in checklist for comparison.
 */
export async function loadMoveOutContext(
  db: Queryable,
  tenantId: string,
  contractId: string,
  moveOutDate: string,
) {
  const scope = withTenant(db, tenantId);
  const [found] = await scope.select(contract, eq(contract.id, contractId));
  if (!found) return null;
  const [roomRow] = await scope.select(room, eq(room.id, found.roomId));
  const plans = await scope.select(ratePlan, eq(ratePlan.buildingId, roomRow!.buildingId));
  const plan = ratePlanOn(plans, moveOutDate);
  const readings = await Promise.all(
    (['electricity', 'water'] as const).map(async (kind) => {
      const [last] = await scope
        .select(meterReading, and(eq(meterReading.roomId, roomRow!.id), eq(meterReading.kind, kind)))
        .orderBy(desc(meterReading.period))
        .limit(1);
      return [kind, last ?? null] as const;
    }),
  );
  const [moveInList] = await scope.select(
    checklist,
    and(eq(checklist.contractId, contractId), eq(checklist.kind, 'move_in')),
  );
  const invoices = await scope.select(invoice, eq(invoice.contractId, contractId));
  const open = invoices.filter((i) => i.status === 'sent' || i.status === 'partially_paid');
  const openIds = new Set(open.map((i) => i.id));
  const lines = openIds.size === 0 ? [] : await scope.select(invoiceLine);
  // The deposit is held as received (contract.deposit_received), so its line is not money owed at move-out.
  const depositOnOpen = lines
    .filter((l) => openIds.has(l.invoiceId) && l.kind === 'deposit')
    .reduce((sum, l) => sum + l.amountSatang, 0);
  const owed = open.reduce((sum, i) => sum + (i.totalSatang - i.paidSatang), 0);
  const unpaid = Math.max(0, owed - depositOnOpen);
  const [type] = await scope.select(roomType, eq(roomType.id, roomRow!.roomTypeId));
  return {
    contract: found,
    room: roomRow!,
    roomTypeName: type?.nameTh ?? '',
    plan,
    lastElectricity: readings.find(([kind]) => kind === 'electricity')?.[1] ?? null,
    lastWater: readings.find(([kind]) => kind === 'water')?.[1] ?? null,
    moveInItems: moveInList?.items ?? null,
    unpaid,
  };
}
