import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { SettingsIndex } from '@/src/components/settings/SettingsIndex';

/** Settings: every page in its group, with a line on what it holds (ux-v2/rentroll.md › Settings). */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SettingsIndex locale={locale} />;
}
