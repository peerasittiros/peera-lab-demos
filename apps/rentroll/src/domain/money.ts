/** Integer satang (1 baht = 100 satang). Every amount in `src/domain` is a Satang. */
export type Satang = number;

export function assertSatang(value: number, label = 'amount'): Satang {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a whole number of satang, got ${value}`);
  }
  return value;
}

/** Rounds to the nearest whole baht, halves up. */
export function roundToBaht(satang: Satang): Satang {
  return Math.floor((satang + 50) / 100) * 100;
}

/** Integer division rounded to the nearest whole, halves up. Both arguments must be non-negative. */
export function divRound(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}
