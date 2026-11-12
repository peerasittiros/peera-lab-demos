import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { BillingSettings } from '@/src/components/settings/BillingSettings';

/** Bill day, due day and the note at the foot of an invoice. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <BillingSettings locale={locale} />;
}
