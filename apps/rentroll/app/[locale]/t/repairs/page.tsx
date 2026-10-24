import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { TenantRepairsLive } from '@/src/components/live/RepairsLive';
import { translator } from '@/src/i18n';

/** The tenant's repair requests (SPEC §4 T5). */
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
      <PageHeader locale={locale} title={m.tenant.repairs.title} />
      <TenantRepairsLive locale={locale} />
    </>
  );
}
