import { Bai_Jamjuree, Barlow, Barlow_Semi_Condensed, IBM_Plex_Mono } from 'next/font/google';
import { plexSansThai } from '@peera/ui/fonts';

// Stockline's own faces (demo_product/ux-v2/stockline.md, theme "Back-room clipboard"): Barlow for Latin text,
// Bai Jamjuree for Thai headings, Barlow Semi Condensed for quantities. Thai body text and codes use the shared
// IBM Plex Sans Thai and IBM Plex Mono.
// Codes (SKU, barcodes) use IBM Plex Mono, Stockline's own instance so it is not preloaded: it is small print, and
// on a slow phone connection the preloads went to fonts before the text that is the page's LCP.
// Only the body faces are preloaded; the heading and quantity faces swap in, so they don't compete with the body
// text on a slow connection (Lighthouse mobile, V7).
export const barlow = Barlow({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--nf-barlow',
});
export const barlowCondensed = Barlow_Semi_Condensed({
  weight: ['600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--nf-barlow-condensed',
  preload: false,
});
export const baiJamjuree = Bai_Jamjuree({
  weight: ['500', '600'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--nf-bai-jamjuree',
  preload: false,
});

export const plexMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--nf-plex-mono',
  preload: false,
});

export const fontVariables = [barlow, barlowCondensed, baiJamjuree, plexSansThai, plexMono]
  .map((font) => font.variable)
  .join(' ');
