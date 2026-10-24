import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { MoveOutLive } from '@/src/components/live/ContractsLive';

/** Move-out (SPEC §4 O8): final readings, the settlement preview, then confirm. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; contractId: string }>;
}) {
  const { locale, contractId } = await params;
  if (!isLocale(locale)) notFound();
  return <MoveOutLive locale={locale} contractId={contractId} />;
}
