import { withTenant, type Queryable } from '@peera/db';
import { isLiveContract, roomStatus, type RoomStatus } from '../../domain/property';
import { building, contract, contractRenter, invoice, ratePlan, renter, room, roomType } from '../schema';

export type RoomView = {
  id: string;
  buildingId: string;
  number: string;
  floor: number;
  sort: number;
  roomTypeId: string;
  roomTypeNameTh: string;
  roomTypeNameEn: string | null;
  sizeSqm: number | null;
  elecMeterDigits: number;
  waterMeterDigits: number;
  maintenance: boolean;
  status: RoomStatus;
  /** The live contract that sets the status, if any. */
  contractId: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  renterName: string | null;
  /** Sent invoices past due with money still owed, across all contracts of the room. */
  overdueCount: number;
  overdueSatang: number;
};

/** The first word of a renter's name, for tiles (01 §8 screen 2). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Everything the property screens need, in one tenant-scoped read. `today` is the Bangkok date. */
export async function loadProperty(db: Queryable, tenantId: string, today: string) {
  const scope = withTenant(db, tenantId);
  const [buildings, roomTypes, plans, rooms, contracts, links, renters, invoices] = await Promise.all([
    scope.select(building),
    scope.select(roomType),
    scope.select(ratePlan),
    scope.select(room),
    scope.select(contract),
    scope.select(contractRenter),
    scope.select(renter),
    scope.select(invoice),
  ]);

  const typeById = new Map(roomTypes.map((t) => [t.id, t]));
  const renterById = new Map(renters.map((r) => [r.id, r]));
  const primaryRenter = new Map(
    links.filter((l) => l.isPrimary).map((l) => [l.contractId, renterById.get(l.renterId)?.name ?? null]),
  );
  const contractsByRoom = new Map<string, typeof contracts>();
  for (const c of contracts) {
    const list = contractsByRoom.get(c.roomId) ?? [];
    list.push(c);
    contractsByRoom.set(c.roomId, list);
  }
  const roomByContract = new Map(contracts.map((c) => [c.id, c.roomId]));
  const overdueByRoom = new Map<string, { count: number; satang: number }>();
  for (const inv of invoices) {
    const roomId = roomByContract.get(inv.contractId);
    const owed = inv.totalSatang - inv.paidSatang;
    const overdue = (inv.status === 'sent' || inv.status === 'partially_paid') && inv.dueDate < today && owed > 0;
    if (!roomId || !overdue) continue;
    const entry = overdueByRoom.get(roomId) ?? { count: 0, satang: 0 };
    entry.count += 1;
    entry.satang += owed;
    overdueByRoom.set(roomId, entry);
  }

  const roomViews: RoomView[] = rooms
    .map((r) => {
      const own = contractsByRoom.get(r.id) ?? [];
      const live = own.filter((c) => isLiveContract(c, today));
      live.sort((a, b) => a.startDate.localeCompare(b.startDate));
      const current = live.find((c) => c.startDate <= today) ?? live[0] ?? null;
      const type = typeById.get(r.roomTypeId);
      const overdue = overdueByRoom.get(r.id);
      return {
        id: r.id,
        buildingId: r.buildingId,
        number: r.number,
        floor: r.floor,
        sort: r.sort,
        roomTypeId: r.roomTypeId,
        roomTypeNameTh: type?.nameTh ?? '',
        roomTypeNameEn: type?.nameEn ?? null,
        sizeSqm: r.sizeSqm,
        elecMeterDigits: r.elecMeterDigits,
        waterMeterDigits: r.waterMeterDigits,
        maintenance: r.maintenance,
        status: roomStatus({ maintenance: r.maintenance, contracts: own, today }),
        contractId: current?.id ?? null,
        contractStart: current?.startDate ?? null,
        contractEnd: current?.endDate ?? null,
        renterName: current ? (primaryRenter.get(current.id) ?? null) : null,
        overdueCount: overdue?.count ?? 0,
        overdueSatang: overdue?.satang ?? 0,
      } satisfies RoomView;
    })
    .sort((a, b) => a.floor - b.floor || a.sort - b.sort || a.number.localeCompare(b.number));

  return { buildings, roomTypes, ratePlans: plans, rooms: roomViews };
}
