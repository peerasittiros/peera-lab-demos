import { accentStyle } from '@peera/ui/accents';
import { fontVariables } from '@peera/ui/fonts';
import { ThemeScript } from '@peera/ui/ThemeScript';
import type { ReactNode } from 'react';
import './globals.css';

/**
 * The only `<html>` in the app. `lang` starts as Thai and `LangSync` in the locale layout corrects it on the client,
 * because the root layout cannot read the route's locale.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <style dangerouslySetInnerHTML={{ __html: accentStyle('rentroll') }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
