import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { detectColumns, validateRows } from '../domain/import';
import { workbookRows } from './workbook';

/** Excel's serial number for a calendar day, independent of the machine's time zone. */
function serial(year: number, month: number, day: number) {
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** A Thai shop sheet as Excel writes it: typed numbers, a real date cell and a Buddhist-year date typed as text. */
function shopWorkbook(): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      'ชื่อสินค้า',
      'รหัสสินค้า',
      'หน่วย',
      'จำนวน',
      'ราคาทุน',
      'ขั้นต่ำ',
      'วันที่',
    ],
    ['ชาไทยพร้อมดื่ม 350 มล.', 'TEA-350', 'ขวด', 1200, 12.5, 240, null],
    ['ขนมเปี๊ยะ', 'PIA-01', 'ชิ้น', 36, 18, 12, '21 ต.ค. 2569'],
    [],
    ['', 'EMPTY', 'ชิ้น', 3, null, null, null],
  ]);
  // Row 2's date is a number with a date format, as Excel stores 1 Oct 2026; the quantity shows a thousands separator.
  sheet.G2 = { t: 'n', v: serial(2026, 10, 1), z: 'd/m/yyyy' };
  sheet.D2 = { t: 'n', v: 1200, z: '#,##0' };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'สต็อก');
  return XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

describe('workbookRows', () => {
  it('reads the first sheet as text: numbers plain, date cells as days, empty rows dropped', async () => {
    const rows = await workbookRows(shopWorkbook());
    expect(rows).toEqual([
      [
        'ชื่อสินค้า',
        'รหัสสินค้า',
        'หน่วย',
        'จำนวน',
        'ราคาทุน',
        'ขั้นต่ำ',
        'วันที่',
      ],
      [
        'ชาไทยพร้อมดื่ม 350 มล.',
        'TEA-350',
        'ขวด',
        '1200',
        '12.5',
        '240',
        '2026-10-01',
      ],
      ['ขนมเปี๊ยะ', 'PIA-01', 'ชิ้น', '36', '18', '12', '21 ต.ค. 2569'],
      ['', 'EMPTY', 'ชิ้น', '3', '', '', ''],
    ]);
  });

  it('feeds the same column detection and validation as CSV', async () => {
    const rows = await workbookRows(shopWorkbook());
    const result = validateRows(rows, detectColumns(rows[0]!), {
      skus: new Set(),
      barcodes: new Set(),
    });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      nameTh: 'ชาไทยพร้อมดื่ม 350 มล.',
      quantity: 1200,
      costBaht: 12.5,
      minQty: 240,
      date: '2026-10-01',
    });
    expect(result.rows[1]).toMatchObject({ date: '2026-10-21' });
    expect(
      result.invalid.map((entry) => entry.errors.map((error) => error.key)),
    ).toEqual([['nameMissing']]);
  });

  it('reads an OpenDocument sheet too', async () => {
    const book = XLSX.read(shopWorkbook(), { type: 'array' });
    const ods = XLSX.write(book, {
      bookType: 'ods',
      type: 'array',
    }) as ArrayBuffer;
    const rows = await workbookRows(ods);
    expect(rows[1]?.slice(0, 4)).toEqual([
      'ชาไทยพร้อมดื่ม 350 มล.',
      'TEA-350',
      'ขวด',
      '1200',
    ]);
  });

  it('gives no rows for a workbook without data', async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([]), 'ว่าง');
    const empty = XLSX.write(book, {
      bookType: 'xlsx',
      type: 'array',
    }) as ArrayBuffer;
    expect(await workbookRows(empty)).toEqual([]);
  });
});
