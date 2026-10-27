// CSV that opens cleanly in Excel and Google Sheets with Thai text: UTF-8 with a BOM, CRLF line ends, RFC 4180
// quoting. Cells that start like a formula are prefixed with an apostrophe (CSV injection).

export const BOM = '\uFEFF';

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text))
    text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: unknown[]): string {
  return `${values.map(csvCell).join(',')}\r\n`;
}

/** A streaming CSV response: the BOM and header first, then rows as the source yields them. */
export function csvResponse(
  filename: string,
  header: string[],
  rows: AsyncIterable<unknown[]> | Iterable<unknown[]>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(BOM + csvRow(header)));
      let buffer = '';
      for await (const row of rows) {
        buffer += csvRow(row);
        if (buffer.length > 16_384) {
          controller.enqueue(encoder.encode(buffer));
          buffer = '';
        }
      }
      if (buffer) controller.enqueue(encoder.encode(buffer));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
