import { BOM, csvRow } from './csv';

/** Saves rows as a CSV file (UTF-8 with a BOM, so Thai opens cleanly in Excel). Runs in the browser only. */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: unknown[][],
) {
  const blob = new Blob(
    [BOM + csvRow(header) + rows.map((row) => csvRow(row)).join('')],
    {
      type: 'text/csv;charset=utf-8',
    },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
