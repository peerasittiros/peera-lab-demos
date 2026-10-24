import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { DashboardLive } from '@/src/components/live/OwnerDashboard';

/** Owner dashboard (SPEC §4 O1), computed from the browser store. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <DashboardLive locale={locale} />;
}
