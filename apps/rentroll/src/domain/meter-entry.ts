import type { MeterRoomRow } from './billing-run';

/** The rate fields a meter line is priced from (a rate plan row). */
export type MeterRates = {
  elecRateSatang: number;
  elecMinSatang: number;
  waterMode: string;
  waterRateSatang: number;
  waterMinSatang: number;
};

/**
 * Units used for a reading typed into the meter round, shown live before it is saved. A reading below the previous one
 * counts as a rollover only when confirmed (the meter wrapped past its last digit); otherwise there is no figure yet.
 */
export function unitsFor(
  row: Pick<MeterRoomRow, 'previous' | 'digits'>,
  value: string,
  rollover: boolean,
): number | null {
  if (value === '' || !/^\d+$/.test(value)) return null;
  const reading = Number(value);
  if (row.previous === null) return null;
  if (reading >= row.previous) return reading - row.previous;
  if (!rollover) return null;
  return 10 ** row.digits - row.previous + reading;
}

/**
 * What the units will cost on the bill, at the plan's rate with its minimum. Water billed per person has no per-unit
 * figure, so it returns null there.
 */
export function amountFor(
  rates: MeterRates | null,
  kind: 'electricity' | 'water',
  units: number | null,
): number | null {
  if (!rates || units === null) return null;
  if (kind === 'electricity')
    return Math.max(units * rates.elecRateSatang, rates.elecMinSatang);
  if (rates.waterMode !== 'per_unit') return null;
  return Math.max(units * rates.waterRateSatang, rates.waterMinSatang);
}
