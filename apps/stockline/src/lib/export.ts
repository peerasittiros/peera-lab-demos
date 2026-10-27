import type { Locale } from '@peera/i18n';
import type { ItemView } from '../domain/read-models';
import type { MovementView } from '../domain/read-models';
import { stockValue, type Role } from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { bangkokDay } from '../client-store/relativize';

// CSV rows for the history and the items list, built in the browser. Headers are in the UI language; staff get no
// money columns. The file itself is written by `downloadCsv` (lib/download.ts).

const baht = (satang: number | null | undefined) =>
  satang == null ? '' : (satang / 100).toFixed(2);

/** "2026-10-22 14:30" in Bangkok: unambiguous and sortable in any spreadsheet. */
export function sheetTime(value: Date): string {
  const day = bangkokDay(value);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
  return `${day} ${time}`;
}

export function historyCsv(rows: MovementView[], locale: Locale, role: Role) {
  const { m } = translator(locale);
  const h = m.csv.history;
  const owner = role === 'owner';
  const header = [
    h.time,
    h.sku,
    h.item,
    h.type,
    h.reason,
    h.quantity,
    h.unit,
    h.entered,
    h.enteredUnit,
    h.balance,
  ];
  if (owner) header.push(h.unitCost);
  header.push(h.reference, h.user, h.note);
  const body = rows.map((row) => {
    const cells: unknown[] = [
      sheetTime(row.occurredAt),
      row.item.sku,
      nameIn(row.item, locale),
      m.types[row.type],
      m.reasons[row.reason as keyof typeof m.reasons] ?? row.reason,
      row.quantityBase,
      nameIn(row.item.baseUnit, locale),
      row.enteredQty,
      row.enteredUnit ? nameIn(row.enteredUnit, locale) : '',
      row.balanceAfter,
    ];
    if (owner) cells.push(baht(row.unitCostSatang));
    cells.push(row.reference, row.userName, row.note);
    return cells;
  });
  return { header, rows: body };
}

export function itemsCsv(
  items: ItemView[],
  locale: Locale,
  role: Role,
  lookup: {
    categoryName: (id: string | null) => string;
    supplierName: (id: string | null) => string;
  },
) {
  const { m } = translator(locale);
  const h = m.csv.items;
  const owner = role === 'owner';
  const header = [
    h.sku,
    h.barcode,
    h.nameTh,
    h.nameEn,
    h.category,
    h.unit,
    h.onHand,
    h.minQty,
    h.reorderQty,
    h.status,
  ];
  if (owner) header.push(h.cost, h.price, h.value);
  header.push(h.supplier, h.location);
  const body = items.map((row) => {
    const cells: unknown[] = [
      row.sku,
      row.barcode,
      row.nameTh,
      row.nameEn,
      lookup.categoryName(row.categoryId),
      nameIn(row.baseUnit, locale),
      row.onHand,
      row.minQty,
      row.reorderQty,
      m.status[row.status],
    ];
    if (owner)
      cells.push(
        baht(row.costSatang),
        baht(row.priceSatang),
        baht(stockValue(row.onHand, row.costSatang ?? null)),
      );
    cells.push(lookup.supplierName(row.supplierId), row.location);
    return cells;
  });
  return { header, rows: body };
}

/** The file name's date: today in Bangkok. */
export function exportDate(now: Date = new Date()): string {
  return bangkokDay(now);
}
