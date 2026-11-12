import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { RoomTypeSettings } from '@/src/components/settings/RoomTypeSettings';

/** Room types: names, order and removing a type no room uses. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <RoomTypeSettings locale={locale} />;
}
