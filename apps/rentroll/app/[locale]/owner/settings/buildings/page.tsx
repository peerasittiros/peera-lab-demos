import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { BuildingsFloorsSettings } from '@/src/components/settings/BuildingsFloorsSettings';

/** Building names and the order of floors on the room map. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <BuildingsFloorsSettings locale={locale} />;
}
