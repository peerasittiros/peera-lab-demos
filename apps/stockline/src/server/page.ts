import { isLocale, type Locale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { translator } from '../i18n';

/**
 * The locale from the route and the translators: what every page starts with. Nothing here touches the database;
 * the role and the shop are chosen in the browser (client-store/role.tsx, client-store/hooks.tsx).
 */
export async function pageContext(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { locale: locale as Locale, ...translator(locale) };
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function param(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() ? first.trim() : undefined;
}
