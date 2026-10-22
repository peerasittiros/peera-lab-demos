import { DemoSessionProvider } from '@peera/demo-kit';
import { readDemoHeaders } from '@peera/demo-kit/proxy';
import { isLocale, LocaleProvider } from '@peera/i18n';
import { accentStyle } from '@peera/ui/accents';
import { fontVariables } from '@peera/ui/fonts';
import { ThemeScript } from '@peera/ui/ThemeScript';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { messages } from '@/messages';
import '../globals.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: isLocale(locale)
      ? messages[locale].meta.title
      : messages.th.meta.title,
    robots: { index: false, follow: false },
  };
}

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
        <style dangerouslySetInnerHTML={{ __html: accentStyle('stockline') }} />
      </head>
      <body>
        <LocaleProvider locale={locale} messages={messages[locale]}>
          <DemoSessionProvider
            token={session?.token ?? ''}
            via={session?.via ?? 'cookie'}
          >
            {children}
          </DemoSessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
