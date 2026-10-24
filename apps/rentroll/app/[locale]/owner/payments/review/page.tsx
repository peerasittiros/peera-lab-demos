import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { ReviewLive } from '@/src/components/live/ReviewLive';
import { translator } from '@/src/i18n';

/** Owner payment review (01 §3.1 C.11, §8 screen 9): the slip queue and manual entry, from the browser store. */
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
        title={m.payments.title}
        description={m.payments.intro}
      />
      <ReviewLive locale={locale} />
    </>
  );
}
