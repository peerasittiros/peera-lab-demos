import {
  DM_Sans,
  IBM_Plex_Mono,
  IBM_Plex_Sans_Thai,
  Work_Sans,
} from 'next/font/google';
import { anuphan } from '@peera/ui/fonts';

/**
 * RentEase faces (DESIGN.md §3). Anuphan and IBM Plex come from the shared `@peera/ui/fonts` set; Work Sans and DM Sans
 * are Rentroll-only. The shared Funnel Display is left out: `theme.css` replaces every `--font-*` stack.
 */
export const workSans = Work_Sans({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--nf-work-sans',
});

export const dmSans = DM_Sans({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--nf-dm-sans',
});

export const plexSansThai = IBM_Plex_Sans_Thai({
  weight: ['400', '500'],
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

export const fontVariables = [workSans, dmSans, anuphan, plexSansThai, plexMono]
  .map((font) => font.variable)
  .join(' ');
