import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { Gallery } from './Gallery';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Gallery locale={locale} />;
}
