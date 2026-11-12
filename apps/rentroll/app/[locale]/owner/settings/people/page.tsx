import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { PeopleSettings } from '@/src/components/settings/PeopleSettings';

/** The names the account menu shows for the owner, the caretaker and the sample tenant. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <PeopleSettings locale={locale} />;
}
