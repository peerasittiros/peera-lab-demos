import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { RoleHome } from '@/src/components/nav/RoleHome';

/**
 * The app's front door: it sends each role to its own start page (the owner to the overview, the tenant to their
 * home). The role lives in this browser, so the choice is made on the client.
 */
export default async function RentrollHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <RoleHome locale={locale} />;
}
