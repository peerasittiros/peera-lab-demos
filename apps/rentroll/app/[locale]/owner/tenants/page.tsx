import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { TenantsLive } from '@/src/components/live/ContractsLive';
import { translator } from '@/src/i18n';

/** Renter profiles (SPEC §4 O6), read from the browser store. */
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
        title={m.contracts.tenants.title}
        description={m.contracts.tenants.intro}
      />
      <TenantsLive locale={locale} />
    </>
  );
}
