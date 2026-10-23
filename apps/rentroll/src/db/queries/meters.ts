import { withTenant, type Queryable } from '@peera/db';
import { and, eq } from 'drizzle-orm';
import type { MeterKind } from '../../domain/meter-queue';
import { meterReading, room } from '../schema';

export type MeterRoomRow = {
  roomId: string;
  number: string;
  floor: number;
  sort: number;
  digits: number;
  previous: number | null;
  previousPeriod: string | null;
  /** The reading for the round's period, if one is on file. */
  current: number | null;
  currentUnits: number | null;
  currentRollover: boolean;
  currentAnomaly: string | null;
  /** Average units of the last three months with usage, before this period. Null without history. */
  averageUnits: number | null;
};

/**
 * The meter round for one building, one meter and one period, in walking order (floor, then sort, then number).
 * Maintenance rooms are left out; every other room keeps a meter, whether or not someone lives there.
 */
export async function loadMeterRound(
  db: Queryable,
  tenantId: string,
  { buildingId, kind, period }: { buildingId: string; kind: MeterKind; period: string },
): Promise<MeterRoomRow[]> {
  const scope = withTenant(db, tenantId);
  const [rooms, readings] = await Promise.all([
    scope.select(room, and(eq(room.buildingId, buildingId), eq(room.maintenance, false))),
    scope.select(meterReading, eq(meterReading.kind, kind)),
  ]);
  const byRoom = new Map<string, typeof readings>();
  for (const r of readings) {
    const list = byRoom.get(r.roomId) ?? [];
    list.push(r);
    byRoom.set(r.roomId, list);
  }
  return rooms
    .map((r) => {
      const history = (byRoom.get(r.id) ?? []).sort((a, b) => a.period.localeCompare(b.period));
      const before = history.filter((h) => h.period < period);
      const previous = before.at(-1) ?? null;
      const current = history.find((h) => h.period === period) ?? null;
      const recent = before.filter((h) => h.unitsUsed !== null).slice(-3);
      const averageUnits =
        recent.length === 0 ? null : recent.reduce((sum, h) => sum + (h.unitsUsed ?? 0), 0) / recent.length;
      return {
        roomId: r.id,
        number: r.number,
        floor: r.floor,
        sort: r.sort,
        digits: kind === 'electricity' ? r.elecMeterDigits : r.waterMeterDigits,
        previous: previous?.reading ?? null,
        previousPeriod: previous?.period ?? null,
        current: current?.reading ?? null,
        currentUnits: current?.unitsUsed ?? null,
        currentRollover: current?.isRollover ?? false,
        currentAnomaly: current?.anomaly ?? null,
        averageUnits,
      } satisfies MeterRoomRow;
    })
    .sort((a, b) => a.floor - b.floor || a.sort - b.sort || a.number.localeCompare(b.number));
}
