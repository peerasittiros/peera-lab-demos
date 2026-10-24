import type { MetadataRoute } from 'next';

/**
 * The web app manifest (SPEC §6): opens in its own window at the Thai start page. The surface and primary colours are
 * the RentEase tokens; the icons are the app mark drawn by `app/icons/[name]`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rentroll',
    short_name: 'Rentroll',
    start_url: '/th?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#7c3aed',
    lang: 'th',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/512-maskable',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
