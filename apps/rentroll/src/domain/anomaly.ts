export type ReadingAnomaly =
  'lower_than_previous' | 'above_double_average' | 'below_fifth_of_average';

/**
 * Flags a reading before billing (01 §3.1 C.8). `averageUnits` is the room's average over the last three months, or
 * null when there is no history yet (then only the lower-than-previous check runs).
 */
export function readingAnomaly({
  current,
  previous,
  units,
  averageUnits,
}: {
  current: number;
  previous: number;
  units: number;
  averageUnits: number | null;
}): ReadingAnomaly | null {
  if (current < previous) return 'lower_than_previous';
  if (averageUnits === null) return null;
  if (units > 2 * averageUnits) return 'above_double_average';
  // "less than 20% of the average", written without division.
  if (5 * units < averageUnits) return 'below_fifth_of_average';
  return null;
}
