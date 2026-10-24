import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { BillingRunLive } from '@/src/components/live/BillingRunLive';

/** Billing run (SPEC §4 O10): check meters, review, generate, send. `current` is the current Bangkok month. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; period: string }>;
}) {
  const { locale, period } = await params;
  if (!isLocale(locale)) notFound();
  if (period !== 'current' && !/^\d{4}-\d{2}$/.test(period)) notFound();
  return <BillingRunLive locale={locale} period={period} />;
}
