import { DemoSessionProvider } from '@peera/demo-kit';
import { readDemoHeaders } from '@peera/demo-kit/proxy';
import { isLocale, LocaleProvider, locales } from '@peera/i18n';
import { ToastProvider } from '@peera/ui';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { messages } from '@/messages';
import { AppShell } from '@/src/components/AppShell';
import { LangSync } from '@/src/components/LangSync';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: messages[isLocale(locale) ? locale : 'th'].meta.title,
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = readDemoHeaders(await headers());

  return (
    <LocaleProvider locale={locale} messages={messages[locale]}>
      <LangSync locale={locale} />
      <DemoSessionProvider
        token={session?.token ?? ''}
        via={session?.via ?? 'cookie'}
      >
        <ToastProvider locale={locale}>
          <AppShell locale={locale}>
            {children}
          </AppShell>
        </ToastProvider>
      </DemoSessionProvider>
    </LocaleProvider>
  );
}
