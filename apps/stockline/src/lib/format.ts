import { formatNumber, type Locale } from '@peera/i18n';

// Hoisted, so the shared formatter cache finds it by identity.
const QTY: Intl.NumberFormatOptions = { maximumFractionDigits: 3 };

export type UnitLike = {
  nameTh: string;
  nameEn?: string | null;
  symbol: string;
};

const METRIC = new Set(['g', 'kg', 'ml', 'l']);

function plural(word: string): string {
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/**
 * A unit after a number: Thai uses the Thai name as is ("48 ขวด"); English uses the metric symbol ("900 g") or
 * the lower-case name, plural when needed ("48 bottles", "1 case").
 */
export function unitName(
  unit: UnitLike | null | undefined,
  locale: Locale,
  quantity = 2,
): string {
  if (!unit) return '';
  if (locale === 'th' || !unit.nameEn?.trim()) return unit.nameTh;
  if (METRIC.has(unit.symbol.toLowerCase())) return unit.symbol;
  const name = unit.nameEn.trim().toLowerCase();
  return Math.abs(quantity) === 1 ? name : plural(name);
}

/** "48 ขวด", "1,500 g", "2 cases". Arabic digits, grouped, up to three decimals. */
export function formatQty(
  quantity: number,
  unit: UnitLike | null | undefined,
  locale: Locale,
): string {
  const number = formatNumber(quantity, locale, QTY);
  const name = unitName(unit, locale, quantity);
  return name ? `${number} ${name}` : number;
}

/** A signed quantity for the ledger: "+24", "−6" (true minus sign). */
export function formatSigned(quantity: number, locale: Locale): string {
  const number = formatNumber(Math.abs(quantity), locale, QTY);
  return quantity > 0 ? `+${number}` : quantity < 0 ? `−${number}` : number;
}

/** Satang ↔ the baht a person types. */
export const toSatang = (baht: number) => Math.round(baht * 100);
export const toBaht = (satang: number) => satang / 100;
