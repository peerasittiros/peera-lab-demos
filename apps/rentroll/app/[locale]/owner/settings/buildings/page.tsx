import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { BuildingsRatesLive } from '@/src/components/live/PropertyLive';
import { translator } from '@/src/i18n';

/** Buildings (SPEC §4 O5), read-only in this demo. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { m } = translator(locale);
  return (
    <>
      <PageHeader
        locale={locale}
        title={m.property.buildings.title}
        description={m.property.buildings.intro}
      />
      <BuildingsRatesLive locale={locale} section="buildings" />
    </>
  );
}
