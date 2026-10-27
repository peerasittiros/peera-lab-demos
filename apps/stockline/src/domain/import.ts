// Spreadsheet import (02 §3.1 item 9): parse in the browser, map columns, validate rows. Only the validated rows go
// to the server. Pure functions, so they're tested with fixture files.

export const IMPORT_FIELDS = [
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
  'reorderQty',
  'supplier',
  'location',
  'date',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const MAX_IMPORT_ROWS = 500;

/** Header words people use in Thai and English sheets, normalised (lower case, no spaces or punctuation). */
const SYNONYMS: Record<ImportField, string[]> = {
  nameTh: [
    'ชื่อสินค้า',
    'ชื่อ',
    'สินค้า',
    'รายการ',
    'ชื่อไทย',
    'ชื่อสินค้าไทย',
    'ชื่อภาษาไทย',
    'nameth',
    'thainame',
    'name',
    'item',
    'itemname',
    'product',
    'productname',
    'description',
  ],
  nameEn: [
    'ชื่ออังกฤษ',
    'ชื่อภาษาอังกฤษ',
    'ชื่อสินค้าอังกฤษ',
    'nameen',
    'englishname',
    'nameenglish',
  ],
  sku: ['รหัสสินค้า', 'รหัส', 'sku', 'code', 'itemcode', 'productcode'],
  barcode: ['บาร์โค้ด', 'บาร์โค๊ด', 'barcode', 'ean', 'upc', 'gtin'],
  category: [
    'หมวดหมู่',
    'หมวด',
    'ประเภท',
    'กลุ่มสินค้า',
    'category',
    'group',
    'type',
  ],
  unit: ['หน่วย', 'หน่วยนับ', 'unit', 'uom'],
  quantity: [
    'จำนวน',
    'จำนวนคงเหลือ',
    'คงเหลือ',
    'สต็อก',
    'ยอดคงเหลือ',
    'qty',
    'quantity',
    'onhand',
    'stock',
    'balance',
  ],
  cost: ['ราคาทุน', 'ทุน', 'ต้นทุน', 'cost', 'costprice', 'unitcost'],
  price: ['ราคาขาย', 'ราคา', 'price', 'sellprice', 'saleprice'],
  minQty: [
    'ขั้นต่ำ',
    'จุดสั่งซื้อ',
    'สต็อกขั้นต่ำ',
    'min',
    'minqty',
    'minimum',
    'reorderpoint',
  ],
  reorderQty: [
    'จำนวนสั่ง',
    'จำนวนสั่งต่อครั้ง',
    'สั่งครั้งละ',
    'reorderqty',
    'reorderquantity',
    'orderqty',
  ],
  supplier: ['ผู้ขาย', 'ซัพพลายเออร์', 'ผู้จำหน่าย', 'supplier', 'vendor'],
  location: ['ที่เก็บ', 'ตำแหน่ง', 'ชั้นวาง', 'location', 'shelf', 'bin'],
  date: ['วันที่', 'วันที่ยอด', 'ณวันที่', 'date', 'asof', 'stockdate'],
};

function normalise(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[\s_\-.:()/]+/g, '')
    .trim();
}

/** Delimited text → rows of cells. Handles quotes, CRLF, a BOM, and picks tab, semicolon or comma from the header. */
export function parseDelimited(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.includes('\t')
    ? '\t'
    : firstLine.split(';').length > firstLine.split(',').length
      ? ';'
      : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows
    .map((cells) => cells.map((value) => value.trim()))
    .filter((cells) => cells.some((value) => value !== ''));
}

/** Best guess of which file column holds which field; each field is used once, the first match wins. */
export function detectColumns(headers: string[]): (ImportField | null)[] {
  const used = new Set<ImportField>();
  const exact = headers.map((header) => {
    const key = normalise(header);
    for (const field of IMPORT_FIELDS) {
      if (used.has(field)) continue;
      if (SYNONYMS[field].includes(key)) {
        used.add(field);
        return field;
      }
    }
    return null;
  });
  return exact.map((field, index) => {
    if (field) return field;
    const key = normalise(headers[index] ?? '');
    for (const candidate of IMPORT_FIELDS) {
      if (used.has(candidate) || !key) continue;
      if (
        SYNONYMS[candidate].some(
          (word) => word.length > 2 && key.includes(word),
        )
      ) {
        used.add(candidate);
        return candidate;
      }
    }
    return null;
  });
}

/** "1,250.50", "฿1,250", "1 250 บาท", "(5)" → number; null when empty; NaN when not a number. */
export function parseNumber(value: string | undefined): number | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-');
  const cleaned = raw.replace(/[()฿,\s]|บาท|thb/gi, '').replace(/^-/, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  const number = Number(cleaned);
  return negative ? -number : number;
}

const THAI_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];
const THAI_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

function ymd(year: number, month: number, day: number): string | null {
  const gregorian = year > 2400 ? year - 543 : year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(gregorian, month - 1, day));
  if (
    date.getUTCFullYear() !== gregorian ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${gregorian}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * A date cell → YYYY-MM-DD (Gregorian). Accepts ISO dates, D/M/YYYY (day first, as Thai sheets write it), Buddhist
 * years (2569 → 2026), Thai month names ("21 ต.ค. 2569") and Excel serial numbers. Null when empty; NaN-like
 * invalid input returns 'invalid'.
 */
export function parseDate(
  value: string | undefined,
): string | null | 'invalid' {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (match)
    return (
      ymd(Number(match[1]), Number(match[2]), Number(match[3])) ?? 'invalid'
    );
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(raw);
  if (match)
    return (
      ymd(Number(match[3]), Number(match[2]), Number(match[1])) ?? 'invalid'
    );
  match = /^(\d{1,2})\s*([ก-๙.]+)\s*(\d{4})$/.exec(raw);
  if (match) {
    const name = match[2]!.trim();
    const month =
      THAI_MONTHS.indexOf(name) + 1 || THAI_MONTHS_FULL.indexOf(name) + 1;
    if (month)
      return ymd(Number(match[3]), month, Number(match[1])) ?? 'invalid';
  }
  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    // Excel serial day: 1 = 1900-01-01 (with Excel's 1900 leap-year bug, hence 25569 for 1970-01-01).
    const date = new Date(Math.round((Number(raw) - 25569) * 86_400_000));
    return (
      ymd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()) ??
      'invalid'
    );
  }
  return 'invalid';
}

export type ImportRow = {
  /** 1-based row number in the file, counting the header as row 1. */
  line: number;
  nameTh: string;
  nameEn: string | null;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string | null;
  quantity: number;
  costBaht: number | null;
  priceBaht: number | null;
  minQty: number;
  reorderQty: number;
  supplier: string | null;
  location: string | null;
  date: string | null;
};

export type RowError = {
  key:
    | 'nameMissing'
    | 'numberInvalid'
    | 'negative'
    | 'dateInvalid'
    | 'skuDuplicate'
    | 'skuTaken'
    | 'barcodeDuplicate'
    | 'barcodeTaken';
  field?: ImportField;
  row?: number;
};

export type ValidationResult = {
  rows: ImportRow[];
  invalid: { line: number; errors: RowError[] }[];
};

/** Checks every row against the mapping and the shop's existing SKUs and barcodes. */
export function validateRows(
  table: string[][],
  mapping: (ImportField | null)[],
  existing: { skus: Set<string>; barcodes: Set<string> } = {
    skus: new Set(),
    barcodes: new Set(),
  },
): ValidationResult {
  const rows: ImportRow[] = [];
  const invalid: ValidationResult['invalid'] = [];
  const seenSku = new Map<string, number>();
  const seenBarcode = new Map<string, number>();
  table.slice(1, MAX_IMPORT_ROWS + 1).forEach((cells, index) => {
    const line = index + 2;
    const get = (field: ImportField) => {
      const column = mapping.indexOf(field);
      return column >= 0 ? (cells[column] ?? '').trim() : '';
    };
    const errors: RowError[] = [];
    const nameTh = get('nameTh') || get('nameEn');
    if (!nameTh) errors.push({ key: 'nameMissing' });
    const number = (field: ImportField, integer: boolean) => {
      const parsed = parseNumber(get(field));
      if (parsed === null) return null;
      if (Number.isNaN(parsed)) {
        errors.push({ key: 'numberInvalid', field });
        return null;
      }
      if (parsed < 0) {
        errors.push({ key: 'negative', field });
        return null;
      }
      return integer ? Math.round(parsed) : parsed;
    };
    const quantity = number('quantity', true) ?? 0;
    const costBaht = number('cost', false);
    const priceBaht = number('price', false);
    const minQty = number('minQty', true) ?? 0;
    const reorderQty = number('reorderQty', true) ?? 0;
    const date = parseDate(get('date'));
    if (date === 'invalid') errors.push({ key: 'dateInvalid', field: 'date' });
    const sku = get('sku') || null;
    if (sku) {
      const key = sku.toLowerCase();
      if (seenSku.has(key))
        errors.push({ key: 'skuDuplicate', row: seenSku.get(key) });
      else if (existing.skus.has(key)) errors.push({ key: 'skuTaken' });
      else seenSku.set(key, line);
    }
    const barcode = get('barcode') || null;
    if (barcode) {
      if (seenBarcode.has(barcode))
        errors.push({ key: 'barcodeDuplicate', row: seenBarcode.get(barcode) });
      else if (existing.barcodes.has(barcode))
        errors.push({ key: 'barcodeTaken' });
      else seenBarcode.set(barcode, line);
    }
    if (errors.length > 0) {
      invalid.push({ line, errors });
      return;
    }
    rows.push({
      line,
      nameTh,
      nameEn: get('nameTh') && get('nameEn') ? get('nameEn') : null,
      sku,
      barcode,
      category: get('category') || null,
      unit: get('unit') || null,
      quantity,
      costBaht,
      priceBaht,
      minQty,
      reorderQty,
      supplier: get('supplier') || null,
      location: get('location') || null,
      date: date === 'invalid' ? null : date,
    });
  });
  return { rows, invalid };
}

/** The sample file offered on the upload step (Thai headers, as a shop would write them). */
export const SAMPLE_CSV = [
  'ชื่อสินค้า,ชื่อภาษาอังกฤษ,รหัสสินค้า,บาร์โค้ด,หมวดหมู่,หน่วย,จำนวน,ราคาทุน,ราคาขาย,ขั้นต่ำ,ผู้ขาย,วันที่',
  'ชาไทยพร้อมดื่ม 350 มล.,Thai milk tea 350 ml,TEA-350,,เครื่องดื่ม,ขวด,"1,200",12.50,20,240,บริษัท น้ำใสดี จำกัด,1/10/2569',
  'ขนมเปี๊ยะถั่วเขียว,Mung bean pastry,PIA-01,,ขนมขบเคี้ยว,ชิ้น,36,18,25,12,,2026-10-01',
].join('\r\n');
