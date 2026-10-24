import { readingAnomaly, type ReadingAnomaly } from './anomaly';
import { unitsUsed } from './utilities';

/**
 * One meter reading against the room's history (SPEC §4 O9, 01 §3.1 C.8): the units it implies, and whether it looks
 * wrong. Pure, so the store's command and the replay agree.
 */

export type MeterKind = 'electricity' | 'water';

export type ReadingHistory = {
  period: string;
  reading: number;
  unitsUsed: number | null;
};

export type ReadingInput = {
  period: string;
  reading: number;
  /** The meter wrapped past its maximum; the owner or caretaker confirmed it. */
  rollover: boolean;
};

export type ReadingError =
  | 'meters.errors.future'
  | 'meters.errors.invalid'
  | 'meters.errors.lowerNeedsRollover';

export type ReadingResult =
  | { ok: true; unitsUsed: number | null; anomaly: ReadingAnomaly | null }
  | { ok: false; error: ReadingError };

/**
 * Checks a reading and works out its units and anomaly. `today` is the Bangkok date; a reading for a month that has not
 * started is refused. A reading lower than the last one needs the rollover flag.
 */
export function readingFor(
  history: ReadingHistory[],
  input: ReadingInput,
  digits: number,
  today: string,
): ReadingResult {
  if (input.period > today.slice(0, 7))
    return { ok: false, error: 'meters.errors.future' };
  if (
    !Number.isSafeInteger(input.reading) ||
    input.reading < 0 ||
    input.reading >= 10 ** digits
  ) {
    return { ok: false, error: 'meters.errors.invalid' };
  }
  const before = history
    .filter((h) => h.period < input.period)
    .sort((a, b) => a.period.localeCompare(b.period));
  const previous = before.at(-1) ?? null;
  if (!previous) return { ok: true, unitsUsed: null, anomaly: null };

  if (input.reading < previous.reading && !input.rollover) {
    return { ok: false, error: 'meters.errors.lowerNeedsRollover' };
  }
  const units = unitsUsed({
    previous: previous.reading,
    current: input.reading,
    meterDigits: digits,
    rollover: input.rollover,
  });
  const recent = before.filter((h) => h.unitsUsed !== null).slice(-3);
  const averageUnits =
    recent.length === 0
      ? null
      : recent.reduce((sum, h) => sum + (h.unitsUsed ?? 0), 0) / recent.length;
  // A confirmed rollover is judged on the units it implies, not on the lower raw reading.
  const base =
    input.reading < previous.reading ? input.reading : previous.reading;
  const anomaly = readingAnomaly({
    current: input.reading,
    previous: base,
    units,
    averageUnits,
  });
  return { ok: true, unitsUsed: units, anomaly };
}

/**
 * The meter round row for one room: its previous reading, its average over the last three months with usage, and the
 * reading for the round's period when one is on file.
 */
export function roundRow(
  history: (ReadingHistory & { isRollover: boolean; anomaly: string | null })[],
  period: string,
) {
  const sorted = [...history].sort((a, b) => a.period.localeCompare(b.period));
  const before = sorted.filter((h) => h.period < period);
  const previous = before.at(-1) ?? null;
  const current = sorted.find((h) => h.period === period) ?? null;
  const recent = before.filter((h) => h.unitsUsed !== null).slice(-3);
  const averageUnits =
    recent.length === 0
      ? null
      : recent.reduce((sum, h) => sum + (h.unitsUsed ?? 0), 0) / recent.length;
  return {
    previous: previous?.reading ?? null,
    previousPeriod: previous?.period ?? null,
    current: current?.reading ?? null,
    currentUnits: current?.unitsUsed ?? null,
    currentRollover: current?.isRollover ?? false,
    currentAnomaly: current?.anomaly ?? null,
    averageUnits,
  };
}
