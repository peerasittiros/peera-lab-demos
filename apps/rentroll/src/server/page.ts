import { isLocale, type Locale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { translator } from '../i18n';
import { getContext } from './context';

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** First value of a search param, or undefined. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Locale from the route, the visitor's context and the translators: what every page starts with. */
export async function pageContext(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const context = await getContext();
  return { locale: locale as Locale, ...context, ...translator(locale) };
}
