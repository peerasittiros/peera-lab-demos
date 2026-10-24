import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { MeterRoundLive } from '@/src/components/live/MeterRoundLive';
import { translator } from '@/src/i18n';

/** Meter round (SPEC §4 O9). `current` is the current Bangkok month; the round reads the browser store. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; period: string }>;
}) {
  const { locale, period } = await params;
  if (!isLocale(locale)) notFound();
  if (period !== 'current' && !/^\d{4}-\d{2}$/.test(period)) notFound();
  const { m } = translator(locale);
  return (
    <>
      <PageHeader
        locale={locale}
        title={m.meters.title}
        description={m.meters.intro}
      />
      <MeterRoundLive locale={locale} period={period} />
    </>
  );
}
