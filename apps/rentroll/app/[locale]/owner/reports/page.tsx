import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { SectionIndex } from '@/src/components/nav/SectionIndex';
import { translator } from '@/src/i18n';

/** Reports: the month-end reports, one row each (ux-v2/rentroll.md › Shell). */
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
        title={m.nav.reports}
        description={m.reports.intro}
      />
      <SectionIndex locale={locale} section="reports" />
    </>
  );
}
