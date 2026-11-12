import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { DataSettings } from '@/src/components/settings/DataSettings';

/** CSV exports and resetting the demo. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <DataSettings locale={locale} />;
}
