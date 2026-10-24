import { roundRow, type ReadingHistory } from '@/src/domain/meter-reading';
import type { MeterRoomRow } from '@/src/domain/billing-run';
import type { Data } from '../schema';

/**
 * The meter round for one building, one meter and one period, in walking order (floor, sort, number). Maintenance
 * rooms are left out. Mirrors `loadMeterRound` in `src/db/queries/meters.ts`.
 */
export function meterRound(
  data: Data,
  buildingId: string,
  meterKind: 'electricity' | 'water',
  period: string,
): MeterRoomRow[] {
  return data.room
    .filter((r) => r.buildingId === buildingId && !r.maintenance)
    .map((r) => {
      const history = data.meter_reading
        .filter((m) => m.roomId === r.id && m.kind === meterKind)
        .map((m) => ({
          period: m.period,
          reading: m.reading,
          unitsUsed: m.unitsUsed,
          isRollover: m.isRollover,
          anomaly: m.anomaly,
        }));
      const row = roundRow(history, period);
      return {
        roomId: r.id,
        number: r.number,
        floor: r.floor,
        sort: r.sort,
        digits:
          meterKind === 'electricity' ? r.elecMeterDigits : r.waterMeterDigits,
        previous: row.previous,
        previousPeriod: row.previousPeriod,
        current: row.current,
        currentUnits: row.currentUnits,
        currentRollover: row.currentRollover,
        currentAnomaly: row.currentAnomaly,
        averageUnits: row.averageUnits,
      } satisfies MeterRoomRow;
    })
    .sort(
      (a, b) =>
        a.floor - b.floor ||
        a.sort - b.sort ||
        a.number.localeCompare(b.number),
    );
}

/** A reading's history for the room and meter, for checking a new one against. */
export function readingHistory(
  data: Data,
  roomId: string,
  meterKind: 'electricity' | 'water',
): ReadingHistory[] {
  return data.meter_reading
    .filter((m) => m.roomId === roomId && m.kind === meterKind)
    .map((m) => ({
      period: m.period,
      reading: m.reading,
      unitsUsed: m.unitsUsed,
    }));
}
