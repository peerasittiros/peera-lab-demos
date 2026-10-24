import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { OverdueLive } from '@/src/components/live/OverdueLive';
import { translator } from '@/src/i18n';

/** Overdue invoices and reminders (SPEC §4 O13, O14). */
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
        title={m.payments.overdue.title}
        description={m.payments.overdue.intro}
      />
      <OverdueLive locale={locale} />
    </>
  );
}
