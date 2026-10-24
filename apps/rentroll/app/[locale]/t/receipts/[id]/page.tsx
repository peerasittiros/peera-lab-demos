import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { ReceiptLive } from '@/src/components/live/ReceiptLive';

/** One approved payment as a printable receipt (01 §4), read from the browser store. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <ReceiptLive locale={locale} paymentId={id} />;
}
