import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { ReportLive } from '@/src/components/live/ReportsLive';

/** Deposits report (SPEC §4 O17): print, and CSV on the client. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ReportLive locale={locale} report="deposits" />;
}
