/** The byte-order mark Excel needs to read UTF-8 Thai. */
const BOM = String.fromCharCode(0xfeff);

/** A CSV cell: text is quoted when it holds a comma, a quote or a line break; quotes are doubled. */
function cell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A CSV file as Excel and Google Sheets read it: a byte-order mark first, so Thai text opens intact, and CRLF line
 * ends. Money is baht with two decimals, so callers pass `baht(satang)`.
 */
export function toCsv(
  header: string[],
  rows: (string | number | null)[][],
): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(','));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

/** Integer satang as a baht figure with two decimals, for spreadsheets. */
export function baht(satang: number): string {
  return (satang / 100).toFixed(2);
}
