import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PayLive } from '@/src/components/live/PayLive';

/** Tenant pay screen (01 §3.1 D.13, §8 screen 7), read from the browser store. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; invoiceId: string }>;
}) {
  const { locale, invoiceId } = await params;
  if (!isLocale(locale)) notFound();
  return <PayLive locale={locale} invoiceId={invoiceId} />;
}
