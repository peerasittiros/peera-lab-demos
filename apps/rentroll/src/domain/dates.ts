const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Asia/Bangkok calendar date (YYYY-MM-DD) of an instant. Bangkok has no DST, so a fixed offset is exact. */
export function bangkokDate(instant: Date): string {
  return new Date(instant.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Days from 1970-01-01 to a YYYY-MM-DD date, without time-zone effects. */
export function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / DAY_MS);
}

export function isoFromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Days in a 'YYYY-MM' period. */
export function daysInPeriod(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

export function periodStart(period: string): string {
  return `${period}-01`;
}

/** `YYYY-MM` moved by `months` (negative goes back). */
export function addMonths(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  const index = y! * 12 + (m! - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function periodEnd(period: string): string {
  return `${period}-${String(daysInPeriod(period)).padStart(2, '0')}`;
}
