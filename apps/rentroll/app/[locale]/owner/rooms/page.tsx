import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { RoomMapLive } from '@/src/components/live/PropertyLive';
import { translator } from '@/src/i18n';

/** The room map (SPEC §4 O2), read from the browser store. */
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
        title={m.property.rooms.title}
        description={m.property.rooms.intro}
      />
      <RoomMapLive locale={locale} />
    </>
  );
}
