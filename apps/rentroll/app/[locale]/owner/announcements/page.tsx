import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { AnnouncementsLive } from '@/src/components/live/AnnouncementsLive';
import { translator } from '@/src/i18n';

/** Announcements (SPEC §4 O16). */
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
        title={m.tenant.owner.announce.title}
        description={m.tenant.owner.announce.intro}
      />
      <AnnouncementsLive locale={locale} />
    </>
  );
}
