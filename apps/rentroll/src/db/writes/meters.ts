import { ActionError, withTenant, type Tx } from '@peera/db';
import { and, eq } from 'drizzle-orm';
import { bangkokDate } from '../../domain/dates';
import { readingAnomaly } from '../../domain/anomaly';
import type { MeterKind } from '../../domain/meter-queue';
import { unitsUsed } from '../../domain/utilities';
import { meterReading, room } from '../schema';

export type SaveMeterInput = {
  roomId: string;
  kind: MeterKind;
  period: string;
  reading: number;
  /** The owner or caretaker confirmed the meter wrapped past its maximum. */
  rollover: boolean;
  readBy: string;
  readAt: Date;
};

/**
 * Saves one reading. Idempotent per (room, meter, period): sending the same reading again leaves one row with the
 * same numbers, so a queue that retries after a dropped connection cannot double-count. A lower reading needs the
 * rollover flag. Units and the anomaly are worked out here, against the previous period on file.
 */
export async function saveMeterReading(tx: Tx, tenantId: string, input: SaveMeterInput) {
  const today = bangkokDate(new Date());
  if (input.period > today.slice(0, 7)) {
    throw new ActionError('meter.future_period', 'meters.errors.future');
  }
  const scope = withTenant(tx, tenantId);
  const [roomRow] = await scope.select(room, eq(room.id, input.roomId));
  if (!roomRow) throw new ActionError('room.not_found', 'property.errors.notFound');
  const digits = input.kind === 'electricity' ? roomRow.elecMeterDigits : roomRow.waterMeterDigits;
  if (!Number.isSafeInteger(input.reading) || input.reading < 0 || input.reading >= 10 ** digits) {
    throw new ActionError('meter.invalid', 'meters.errors.invalid');
  }

  const history = await scope.select(
    meterReading,
    and(eq(meterReading.roomId, input.roomId), eq(meterReading.kind, input.kind)),
  );
  const before = history.filter((h) => h.period < input.period).sort((a, b) => a.period.localeCompare(b.period));
  const previous = before.at(-1) ?? null;
  const existing = history.find((h) => h.period === input.period) ?? null;

  let units: number | null = null;
  let anomaly: string | null = null;
  if (previous) {
    if (input.reading < previous.reading && !input.rollover) {
      throw new ActionError('meter.lower_needs_rollover', 'meters.errors.lowerNeedsRollover');
    }
    units = unitsUsed({
      previous: previous.reading,
      current: input.reading,
      meterDigits: digits,
      rollover: input.rollover,
    });
    const recent = before.filter((h) => h.unitsUsed !== null).slice(-3);
    const averageUnits =
      recent.length === 0 ? null : recent.reduce((sum, h) => sum + (h.unitsUsed ?? 0), 0) / recent.length;
    // A confirmed rollover is judged on the units it implies, not on the lower raw reading.
    const base = input.reading < previous.reading ? input.reading : previous.reading;
    anomaly = readingAnomaly({ current: input.reading, previous: base, units, averageUnits });
  }

  const key = and(
    eq(meterReading.roomId, input.roomId),
    eq(meterReading.kind, input.kind),
    eq(meterReading.period, input.period),
  );
  const values = {
    reading: input.reading,
    unitsUsed: units,
    isRollover: input.rollover,
    anomaly,
    readBy: input.readBy,
    readAt: input.readAt,
  };
  if (existing) {
    await scope.update(meterReading, values, key);
  } else {
    await scope.insert(meterReading, [
      { roomId: input.roomId, kind: input.kind, period: input.period, isEstimate: false, ...values },
    ]);
  }
  return { roomId: input.roomId, kind: input.kind, period: input.period, unitsUsed: units, anomaly };
}
