import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { RepairsBoardLive } from '@/src/components/live/RepairsLive';
import { translator } from '@/src/i18n';

/** The repair board (SPEC §4 O15). */
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
        title={m.ownerRepairs.title}
        description={m.ownerRepairs.intro}
      />
      <RepairsBoardLive locale={locale} />
    </>
  );
}
