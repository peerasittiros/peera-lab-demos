import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { TenantHomeLive } from '@/src/components/live/TenantHomeLive';
import { translator } from '@/src/i18n';

/** Tenant home (01 §3.1 D.13, §8 screen 6), read from the browser store. */
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
      <PageHeader locale={locale} title={m.placeholder.tenantHome} />
      <TenantHomeLive locale={locale} />
    </>
  );
}
