import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { RoomTypesLive } from '@/src/components/live/PropertyLive';
import { translator } from '@/src/i18n';

/** Room types side by side (SPEC §4 O4). */
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
        title={m.property.roomTypes.title}
        description={m.property.roomTypes.intro}
      />
      <RoomTypesLive locale={locale} />
    </>
  );
}
