import { assertSatang, type Satang } from './money';

export type MeterInput = {
  previous: number;
  current: number;
  /** Digits on the meter face (room.elec_meter_digits / water_meter_digits). */
  meterDigits: number;
  /** The owner confirmed the meter wrapped past its maximum. Only then is a lower reading accepted. */
  rollover: boolean;
};

/**
 * Units used between two readings. A lower reading is an error unless the owner confirmed a rollover, in which case
 * the meter is assumed to have wrapped at 10^digits.
 */
export function unitsUsed({
  previous,
  current,
  meterDigits,
  rollover,
}: MeterInput): number {
  const max = 10 ** meterDigits;
  if (!Number.isSafeInteger(previous) || !Number.isSafeInteger(current)) {
    throw new RangeError('meter readings must be whole numbers');
  }
  if (previous < 0 || previous >= max || current < 0 || current >= max) {
    throw new RangeError(
      `meter readings must have at most ${meterDigits} digits`,
    );
  }
  if (current >= previous) return current - previous;
  if (!rollover) {
    throw new RangeError(
      'current reading is lower than the previous one: confirm a rollover or fix the typo',
    );
  }
  return current + max - previous;
}

export type ElectricityRate = { ratePerUnit: Satang; minCharge: Satang };

/** max(units × rate, minimum charge). */
export function electricityAmount(
  units: number,
  rate: ElectricityRate,
): Satang {
  return assertSatang(
    Math.max(units * rate.ratePerUnit, rate.minCharge),
    'electricity amount',
  );
}

export type WaterRate =
  | { mode: 'per_unit'; ratePerUnit: Satang; minCharge: Satang }
  | { mode: 'per_person'; perPerson: Satang };

/** Per unit with a minimum charge, or a flat amount per occupant. */
export function waterAmount(
  units: number,
  occupants: number,
  rate: WaterRate,
): Satang {
  if (rate.mode === 'per_person') {
    return assertSatang(rate.perPerson * occupants, 'water amount');
  }
  return assertSatang(
    Math.max(units * rate.ratePerUnit, rate.minCharge),
    'water amount',
  );
}
