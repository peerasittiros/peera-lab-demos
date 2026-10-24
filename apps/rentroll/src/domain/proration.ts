import { divRound, roundToBaht, type Satang } from './money';
import { dayNumber, daysInPeriod, periodEnd, periodStart } from './dates';

/**
 * Days the contract covers inside a 'YYYY-MM' period, both ends inclusive. `endDate` null = open-ended.
 * Returns 0 when the contract does not overlap the period.
 */
export function daysOccupiedInPeriod(
  period: string,
  startDate: string,
  endDate: string | null,
): number {
  const from =
    dayNumber(startDate) > dayNumber(periodStart(period))
      ? startDate
      : periodStart(period);
  const lastDay = periodEnd(period);
  const to =
    endDate !== null && dayNumber(endDate) < dayNumber(lastDay)
      ? endDate
      : lastDay;
  const days = dayNumber(to) - dayNumber(from) + 1;
  return Math.max(0, days);
}

export type ProrationMode = 'prorate' | 'full_month';

/**
 * Rent for the days occupied. `full_month` charges the whole rent regardless of days. `prorate` charges
 * rent × days / days-in-month, rounded to a whole baht.
 */
export function prorateRent({
  monthlyRent,
  period,
  daysOccupied,
  mode,
}: {
  monthlyRent: Satang;
  period: string;
  daysOccupied: number;
  mode: ProrationMode;
}): Satang {
  if (mode === 'full_month') return monthlyRent;
  const inMonth = daysInPeriod(period);
  if (daysOccupied >= inMonth) return monthlyRent;
  return roundToBaht(divRound(monthlyRent * daysOccupied, inMonth));
}
