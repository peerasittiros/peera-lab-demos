import { getPluralT, getT, type Locale } from '@peera/i18n';
import { messages, type Messages } from '@/messages';

export type { Messages };

/** `t` for plain messages and `tp` for plural ones, on the server or in client components. */
export function translator(locale: Locale) {
  return {
    t: getT(locale, messages[locale]),
    tp: getPluralT(locale, messages[locale]),
    m: messages[locale],
  };
}

type Named = { nameTh: string; nameEn?: string | null };

/** Catalog names (items, units, categories) in the active language, falling back to Thai (platform §4.2). */
export function nameIn(
  record: Named | null | undefined,
  locale: Locale,
): string {
  if (!record) return '';
  return locale === 'en' && record.nameEn?.trim()
    ? record.nameEn
    : record.nameTh;
}

export function weekdayName(locale: Locale, weekday: number): string {
  const key = `w${Math.min(7, Math.max(1, weekday))}` as 'w1';
  return messages[locale].weekdays[key];
}
