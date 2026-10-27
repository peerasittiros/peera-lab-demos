// Excel and OpenDocument files for the import (02 §3.1.9), read in the browser with SheetJS. The rows go through the
// same column detection and validation as CSV, so each cell is turned into the text the CSV path would have read.
// SheetJS (about 400 KB) is loaded only when a workbook is picked.

/** The first sheet as rows of text: text as typed, numbers plain, date cells as `yyyy-mm-dd`, empty rows dropped. */
export async function workbookRows(data: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import('xlsx');
  // cellNF keeps each cell's number format, which is how a date cell is told apart from a plain number.
  const book = XLSX.read(data, { type: 'array', cellNF: true });
  const name = book.SheetNames[0];
  const sheet = name ? book.Sheets[name] : undefined;
  if (!sheet?.['!ref']) return [];

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const rows: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as
        { t: string; v?: unknown; z?: string | number; w?: string } | undefined;
      row.push(cell ? cellText(XLSX, cell) : '');
    }
    if (row.some((value) => value !== '')) rows.push(row);
  }
  return rows;
}

type SheetJs = typeof import('xlsx');

function cellText(
  XLSX: SheetJs,
  cell: { t: string; v?: unknown; z?: string | number; w?: string },
): string {
  if (cell.v == null) return '';
  if (cell.t === 'd' && cell.v instanceof Date) return isoDay(cell.v);
  if (cell.t === 'n' && typeof cell.v === 'number') {
    // A date is a number with a date format; write it as a day, not as Excel's serial number.
    if (cell.z != null && XLSX.SSF.is_date(cell.z))
      return XLSX.SSF.format('yyyy-mm-dd', cell.v);
    return String(cell.v);
  }
  if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE';
  if (cell.t === 'e') return '';
  return String(cell.v).trim();
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
