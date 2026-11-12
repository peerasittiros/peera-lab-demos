import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { OwnerOnly } from '@/src/components/OwnerOnly';
import { SettingsFrame } from '@/src/components/settings/SettingsFrame';

/** Settings is the owner's: the page names stay in a column from 768 px, and everyone else is sent home. */
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <OwnerOnly locale={locale}>
      <SettingsFrame locale={locale}>{children}</SettingsFrame>
    </OwnerOnly>
  );
}
