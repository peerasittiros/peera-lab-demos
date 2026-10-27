import type { Locale } from './locale';

const timeZone = 'Asia/Bangkok';
const intlLocale: Record<Locale, string> = {
  th: 'th-TH-u-ca-buddhist-nu-latn',
  en: 'en-GB',
};

// Intl formatters are slow to build and a list formats hundreds of values, so each locale + options pair is built
// once and reused. The output is the same as building a new one per call.
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

function numberFormat(
  locale: string,
  options: Intl.NumberFormatOptions = {},
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, format);
  }
  return format;
}

function dateFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, format);
  }
  return format;
}

function relativeFormat(locale: string): Intl.RelativeTimeFormat {
  let format = relativeFormats.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeFormats.set(locale, format);
  }
  return format;
}

export type MoneyStyle = 'table' | 'prose';

/** Amount is accepted in satang; output is locale-aware and always uses Arabic digits. */
export function formatMoney(
  satang: number,
  locale: Locale,
  style: MoneyStyle = 'table',
): string {
  const amount = satang / 100;
  if (style === 'prose') {
    const formatted = numberFormat(
      locale === 'th' ? 'th-TH-u-nu-latn' : 'en-GB',
      {
        maximumFractionDigits: 0,
      },
    ).format(amount);
    return locale === 'th' ? `${formatted} บาท` : `THB ${formatted}`;
  }
  return numberFormat(locale === 'th' ? 'th-TH-u-nu-latn' : 'en-GB', {
    style: 'currency',
    currency: 'THB',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(
  value: Date | string | number,
  locale: Locale,
): string {
  return dateFormat(intlLocale[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(new Date(value));
}

export function formatDateTime(
  value: Date | string | number,
  locale: Locale,
): string {
  const date = dateFormat(intlLocale[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(new Date(value));
  return `${date} ${formatTime(value, locale)}`;
}

export function formatTime(
  value: Date | string | number,
  locale: Locale,
): string {
  const time = dateFormat(
    locale === 'th' ? 'th-TH-u-nu-latn' : 'en-GB',
    {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    },
  ).format(new Date(value));
  return locale === 'th' ? `${time} น.` : time;
}

export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  return numberFormat(
    locale === 'th' ? 'th-TH-u-nu-latn' : 'en-US',
    options,
  ).format(value);
}

export function formatPercent(
  value: number,
  locale: Locale,
  maximumFractionDigits = 0,
): string {
  return numberFormat(locale === 'th' ? 'th-TH-u-nu-latn' : 'en-GB', {
    style: 'percent',
    maximumFractionDigits,
  }).format(value);
}

export function formatRelative(
  value: Date | string | number,
  locale: Locale,
  now: Date | string | number = new Date(),
): string {
  const difference = new Date(value).getTime() - new Date(now).getTime();
  const absoluteSeconds = Math.abs(difference) / 1000;
  const [unit, divisor]: [Intl.RelativeTimeFormatUnit, number] =
    absoluteSeconds < 60
      ? ['second', 1]
      : absoluteSeconds < 3600
        ? ['minute', 60]
        : absoluteSeconds < 86400
          ? ['hour', 3600]
          : ['day', 86400];
  const amount = Math.round(difference / 1000 / divisor);
  return relativeFormat(
    locale === 'th' ? 'th-TH-u-nu-latn' : 'en-GB',
  ).format(amount, unit);
}

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed))
    throw new RangeError('Phone number contains unsupported characters');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('0066')) return `+66${digits.slice(4)}`;
  if (digits.startsWith('66')) return `+${digits}`;
  if (digits.startsWith('0')) return `+66${digits.slice(1)}`;
  throw new RangeError(
    'Phone number must be a Thai local number or E.164 number',
  );
}

export function formatPhone(
  phone: string,
  mode: 'display' | 'storage' = 'display',
): string {
  const e164 = normalizePhone(phone);
  if (!/^\+66\d{8,9}$/.test(e164))
    throw new RangeError('Phone number must contain 8 or 9 digits after +66');
  if (mode === 'storage') return e164;
  const national = `0${e164.slice(3)}`;
  return national.length === 10
    ? `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`
    : `${national.slice(0, 2)}-${national.slice(2, 5)}-${national.slice(5)}`;
}
