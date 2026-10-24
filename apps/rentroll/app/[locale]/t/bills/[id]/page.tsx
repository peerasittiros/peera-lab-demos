import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { BillDetailLive } from '@/src/components/live/BillDetailLive';

/** One bill (SPEC §4 T2), read from the browser store. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <BillDetailLive locale={locale} invoiceId={id} />;
}
