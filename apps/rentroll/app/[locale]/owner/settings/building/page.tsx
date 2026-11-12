import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { BuildingSettings } from '@/src/components/settings/BuildingSettings';

/** The building's names, logo, address, phone and PromptPay ID. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <BuildingSettings locale={locale} />;
}
