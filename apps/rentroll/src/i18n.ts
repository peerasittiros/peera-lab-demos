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

const dayFormats = new Map<Locale, Intl.DateTimeFormat>();
const monthFormats = new Map<Locale, Intl.DateTimeFormat>();
const intlLocale = (locale: Locale) => (locale === 'th' ? 'th-TH' : 'en-GB');

/**
 * A calendar date (`YYYY-MM-DD`) or timestamp as the reader writes it: "1 พ.ย. 2569" in Thai (Buddhist year), "1 Nov
 * 2026" in English. A bare date is read at Bangkok noon, so it never slips a day. Never render an ISO date as text.
 */
export function formatDay(value: string, locale: Locale): string {
  let format = dayFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocale(locale), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    });
    dayFormats.set(locale, format);
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+07:00`)
    : new Date(value);
  return format.format(date);
}

/** A billing period (`YYYY-MM`) as "ต.ค. 2569" or "Oct 2026". */
export function formatPeriod(period: string, locale: Locale): string {
  let format = monthFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocale(locale), {
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    });
    monthFormats.set(locale, format);
  }
  return format.format(new Date(`${period}-15T12:00:00+07:00`));
}
