import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { RoomDetailLive } from '@/src/components/live/PropertyLive';

/** Room detail (SPEC §4 O3), read from the browser store. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <RoomDetailLive locale={locale} roomId={id} />;
}
