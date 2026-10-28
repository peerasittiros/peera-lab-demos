import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { SectionBack } from '@/src/components/nav/SectionIndex';

/** Every reports page but the index starts with a way back to the list. */
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
    <>
      <SectionBack locale={locale} section="reports" />
      {children}
    </>
  );
}
