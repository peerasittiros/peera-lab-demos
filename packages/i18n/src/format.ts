import type { Locale } from './locale';

const timeZone = 'Asia/Bangkok';
const intlLocale: Record<Locale, string> = {
  th: 'th-TH-u-ca-buddhist-nu-latn',
  en: 'en-GB',
};

export type MoneyStyle = 'table' | 'prose';

/** Amount is accepted in satang; output is locale-aware and always uses Arabic digits. */
export function formatMoney(
  satang: number,
  locale: Locale,
  style: MoneyStyle = 'table',
): string {
  const amount = satang / 100;
  if (style === 'prose') {
    const formatted = new Intl.NumberFormat(
      locale === 'th' ? 'th-TH-u-nu-latn' : 'en-GB',
      {
        maximumFractionDigits: 0,
      },
    ).format(amount);
    return locale === 'th' ? `${formatted} บาท` : `THB ${formatted}`;
  }
  return new Intl.NumberFormat(locale === 'th' ? 'th-TH-u-nu-latn' : 'en-GB', {
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
  return new Intl.DateTimeFormat(intlLocale[locale], {
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
  const date = new Intl.DateTimeFormat(intlLocale[locale], {
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
  const time = new Intl.DateTimeFormat(
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
  return new Intl.NumberFormat(
    locale === 'th' ? 'th-TH-u-nu-latn' : 'en-US',
    options,
  ).format(value);
}

export function formatPercent(
  value: number,
  locale: Locale,
  maximumFractionDigits = 0,
): string {
  return new Intl.NumberFormat(locale === 'th' ? 'th-TH-u-nu-latn' : 'en-GB', {
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
  return new Intl.RelativeTimeFormat(
    locale === 'th' ? 'th-TH-u-nu-latn' : 'en-GB',
    { numeric: 'auto' },
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
