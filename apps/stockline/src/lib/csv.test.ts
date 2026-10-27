import { describe, expect, it } from 'vitest';
import { BOM, csvCell, csvResponse, csvRow } from './csv';

describe('csv', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
  });

  it('neutralises formula-like cells but keeps negative numbers', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-12')).toBe('-12');
    expect(csvCell('-1.5')).toBe('-1.5');
  });

  it('writes Thai as UTF-8 after a BOM, with CRLF rows', async () => {
    const response = csvResponse(
      'x.csv',
      ['ชื่อสินค้า', 'จำนวน'],
      [['น้ำดื่ม 600 มล.', 24]],
    );
    expect(response.headers.get('content-type')).toBe(
      'text/csv; charset=utf-8',
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(
      `${BOM}ชื่อสินค้า,จำนวน\r\nน้ำดื่ม 600 มล.,24\r\n`,
    );
    expect(csvRow([1, 'a'])).toBe('1,a\r\n');
  });
});
