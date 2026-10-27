import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  detectColumns,
  parseDate,
  parseDelimited,
  parseNumber,
  SAMPLE_CSV,
  validateRows,
} from './import';

const fixture = readFileSync(
  new URL('./fixtures/thai-shop.csv', import.meta.url),
  'utf8',
);
// The same file as Excel saves it: UTF-8 with a BOM and CRLF line ends.
const withBom = `\uFEFF${fixture.replace(/\r?\n/g, '\r\n')}`;

describe('parseDelimited', () => {
  it('reads Thai CSV with a BOM, quoted commas and doubled quotes', () => {
    const rows = parseDelimited(withBom);
    expect(rows[0]![0]).toBe('ชื่อสินค้า');
    expect(rows[1]![6]).toBe('1,200');
    expect(rows[2]![0]).toBe('ขนมปังกรอบ "รสเนย"');
    expect(rows).toHaveLength(8);
  });

  it('reads tab-separated rows pasted from Google Sheets', () => {
    const rows = parseDelimited('ชื่อสินค้า\tจำนวน\nน้ำดื่ม\t1,200\n');
    expect(rows).toEqual([
      ['ชื่อสินค้า', 'จำนวน'],
      ['น้ำดื่ม', '1,200'],
    ]);
  });
});

describe('detectColumns', () => {
  it('maps Thai headers like ชื่อสินค้า, จำนวน and ราคาทุน', () => {
    const [header] = parseDelimited(withBom);
    expect(detectColumns(header!)).toEqual([
      'nameTh',
      'nameEn',
      'sku',
      'barcode',
      'category',
      'unit',
      'quantity',
      'cost',
      'price',
      'minQty',
      'supplier',
      'date',
    ]);
  });

  it('maps English headers', () => {
    expect(
      detectColumns([
        'Product name',
        'SKU',
        'Qty',
        'Cost price',
        'Unit',
        'Vendor',
      ]),
    ).toEqual(['nameTh', 'sku', 'quantity', 'cost', 'unit', 'supplier']);
  });
});

describe('cell parsing', () => {
  it('reads thousands separators, baht signs and words', () => {
    expect(parseNumber('1,250.50')).toBe(1250.5);
    expect(parseNumber('฿18')).toBe(18);
    expect(parseNumber('25 บาท')).toBe(25);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('สิบ')).toBeNaN();
  });

  it('reads Buddhist-year and Thai-month dates', () => {
    expect(parseDate('21/10/2569')).toBe('2026-10-21');
    expect(parseDate('21 ต.ค. 2569')).toBe('2026-10-21');
    expect(parseDate('1 ตุลาคม 2569')).toBe('2026-10-01');
    expect(parseDate('2026-10-21')).toBe('2026-10-21');
    expect(parseDate('45950')).toBe('2025-10-20');
    expect(parseDate('32/13/2569')).toBe('invalid');
    expect(parseDate('')).toBeNull();
  });
});

describe('validateRows', () => {
  const table = parseDelimited(withBom);
  const result = validateRows(table, detectColumns(table[0]!), {
    skus: new Set(['rice-5']),
    barcodes: new Set(),
  });

  it('accepts good rows with numbers and dates normalised', () => {
    expect(result.rows.map((row) => row.line)).toEqual([2, 3]);
    expect(result.rows[0]).toMatchObject({
      nameTh: 'น้ำดื่ม 1.5 ลิตร แพ็ค',
      nameEn: 'Drinking water 1.5 L',
      quantity: 1200,
      costBaht: 8.5,
      priceBaht: 1250,
      minQty: 120,
      date: '2026-10-21',
    });
    expect(result.rows[1]).toMatchObject({
      costBaht: 18,
      priceBaht: 25,
      date: '2026-10-21',
    });
  });

  it('reports every problem row with reasons', () => {
    const byLine = Object.fromEntries(
      result.invalid.map((entry) => [
        entry.line,
        entry.errors.map((error) => error.key),
      ]),
    );
    expect(byLine).toEqual({
      4: ['skuTaken'],
      5: ['nameMissing'],
      6: ['numberInvalid'],
      7: ['negative', 'dateInvalid', 'skuDuplicate'],
      8: ['barcodeDuplicate'],
    });
    const duplicate = result.invalid
      .find((entry) => entry.line === 7)!
      .errors.find((error) => error.key === 'skuDuplicate');
    expect(duplicate?.row).toBe(2);
  });

  it('accepts the sample file shown on the upload step', () => {
    const sample = parseDelimited(SAMPLE_CSV);
    const checked = validateRows(sample, detectColumns(sample[0]!));
    expect(checked.invalid).toEqual([]);
    expect(checked.rows).toHaveLength(2);
    expect(checked.rows[0]!.date).toBe('2026-10-01');
  });
});
