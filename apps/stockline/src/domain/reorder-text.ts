import type { Locale } from '@peera/i18n';
import { formatQty, type UnitLike } from '../lib/format';

// The supplier message behind "Copy as text" and "Send to LINE" (02 §3.1 item 4). The format is fixed so suppliers
// get the same layout every week; snapshot tests pin it in both languages.

export type ReorderTextLine = {
  name: string;
  /** Base units to order. */
  quantity: number;
  baseUnit: UnitLike;
  /** The pack the supplier sells in, if any (1 ลัง = 24 ขวด). */
  pack: { unit: UnitLike; factor: number } | null;
};

function lineQuantity(line: ReorderTextLine, locale: Locale): string {
  const base = formatQty(line.quantity, line.baseUnit, locale);
  if (!line.pack || line.quantity % line.pack.factor !== 0) return base;
  return `${formatQty(line.quantity / line.pack.factor, line.pack.unit, locale)} (${base})`;
}

export function reorderMessage({
  locale,
  shopName,
  supplierName,
  lines,
}: {
  locale: Locale;
  shopName: string;
  supplierName: string;
  lines: ReorderTextLine[];
}): string {
  const items = lines.map(
    (line, index) =>
      `${index + 1}. ${line.name} — ${lineQuantity(line, locale)}`,
  );
  if (locale === 'th')
    return [
      `เรียน ${supplierName}`,
      `${shopName} ขอสั่งสินค้าตามรายการนี้`,
      '',
      ...items,
      '',
      `รวม ${lines.length} รายการ`,
      'รบกวนแจ้งวันส่งของด้วย ขอบคุณ',
    ].join('\n');
  return [
    `Hello ${supplierName},`,
    `${shopName} would like to order the following:`,
    '',
    ...items,
    '',
    `${lines.length} ${lines.length === 1 ? 'item' : 'items'} in total.`,
    'Please let us know the delivery date. Thank you.',
  ].join('\n');
}
