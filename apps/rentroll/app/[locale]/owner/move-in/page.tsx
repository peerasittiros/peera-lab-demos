import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { MoveInLive } from '@/src/components/live/ContractsLive';

/** Move-in (SPEC §4 O7), read from and written to the browser store. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <MoveInLive locale={locale} />;
}
