import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { TenantBillsLive } from '@/src/components/live/TenantBillsLive';

/** The tenant's bills for twelve months, with usage (01 §3.1 D.14), read from the browser store. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <TenantBillsLive locale={locale} />;
}
