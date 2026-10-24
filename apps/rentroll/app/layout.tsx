import { ThemeScript } from '@peera/ui/ThemeScript';
import type { ReactNode } from 'react';
import { fontVariables } from '@/src/theme/fonts';
import './globals.css';

/**
 * The only `<html>` in the app. `lang` starts as Thai and `LangSync` in the locale layout corrects it on the client,
 * because the root layout cannot read the route's locale. Colors come from `src/theme/theme.css`, not an inline accent.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
