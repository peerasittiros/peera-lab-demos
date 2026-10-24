import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { InvoicesLive } from '@/src/components/live/InvoicesLive';
import { translator } from '@/src/i18n';

/** Invoices (SPEC §4 O11): every invoice, filtered, with its public link. Read from the browser store. */
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
      <PageHeader locale={locale} title={m.placeholder.invoices} />
      <InvoicesLive locale={locale} />
    </>
  );
}
