export type YearStyle = 'be' | 'ce';

/** Buddhist Era year for a Gregorian year (2026 → 2569). */
export function documentYear(ceYear: number, style: YearStyle): number {
  return style === 'be' ? ceYear + 543 : ceYear;
}

/**
 * `INV-2569-10-0001`: prefix, year in the building's style, month, then a four-digit sequence. The sequence itself
 * comes from `doc_sequence` inside the transaction (D3.6); this only formats it.
 */
export function formatDocumentNumber({
  prefix,
  ceYear,
  month,
  sequence,
  style,
}: {
  prefix: string;
  ceYear: number;
  month: number;
  sequence: number;
  style: YearStyle;
}): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new RangeError('sequence must be between 1 and 9999');
  }
  if (!Number.isSafeInteger(month) || month < 1 || month > 12) {
    throw new RangeError('month must be between 1 and 12');
  }
  const year = documentYear(ceYear, style);
  return `${prefix}-${year}-${String(month).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`;
}
