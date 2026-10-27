import { DemoSessionProvider } from '@peera/demo-kit';
import { readDemoHeaders } from '@peera/demo-kit/proxy';
import { isLocale, LocaleProvider, locales } from '@peera/i18n';
import { ToastProvider } from '@peera/ui';
import { ThemeScript } from '@peera/ui/ThemeScript';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { messages } from '@/messages';
import { AppShell } from '@/src/components/AppShell';
import { SnapshotPreload } from '@/src/components/SnapshotPreload';
import { env } from '@/src/env';
import { StoreProvider } from '@/src/client-store/hooks';
import { RoleProvider } from '@/src/client-store/role';
import { fontVariables } from '@/src/theme/fonts';
import '../globals.css';

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
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <SnapshotPreload />
      </head>
      <body>
        <LocaleProvider locale={locale} messages={messages[locale]}>
          <DemoSessionProvider
            token={session?.token ?? ''}
            via={session?.via ?? 'cookie'}
          >
            <ToastProvider locale={locale}>
              <RoleProvider>
                <StoreProvider>
                  <AppShell locale={locale} siteUrl={env.PEERA_LAB_URL}>
                    {children}
                  </AppShell>
                </StoreProvider>
              </RoleProvider>
            </ToastProvider>
          </DemoSessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
