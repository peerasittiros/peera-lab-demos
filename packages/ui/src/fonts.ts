import {
  Anuphan,
  Funnel_Display,
  IBM_Plex_Mono,
  IBM_Plex_Sans_Thai,
} from 'next/font/google';

export const funnelDisplay = Funnel_Display({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--nf-funnel-display',
});
export const anuphan = Anuphan({
  weight: ['400', '500', '600'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--nf-anuphan',
});
export const plexSansThai = IBM_Plex_Sans_Thai({
  weight: ['400', '500', '600'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--nf-plex-sans-thai',
});
export const plexMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--nf-plex-mono',
});

export const fontVariables = [funnelDisplay, anuphan, plexSansThai, plexMono]
  .map((font) => font.variable)
  .join(' ');
