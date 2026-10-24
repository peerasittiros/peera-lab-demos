import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { ContractDetailLive } from '@/src/components/live/ContractsLive';

/** One contract (SPEC §4 O6), read from the browser store. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <ContractDetailLive locale={locale} contractId={id} />;
}
