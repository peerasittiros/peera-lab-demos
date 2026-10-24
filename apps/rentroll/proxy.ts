import { createDemoProxy } from '@peera/demo-kit/proxy';
import { env } from './src/env';

// Locale redirect + demo session (platform §6.2, Spec corrections 1–2). The tenant itself is created lazily by
// getDemoTenant() on the first server-side data access.
export const proxy = createDemoProxy({
  secret: () => env.DEMO_SESSION_SECRET,
});

export const config = {
  // `/i/[token]` is the public invoice link: no locale redirect and no demo session (01 §6.1). The PWA files (the
  // worker, the manifest, the icons, the apple icon and the offline shell's static files) are served as they are.
  matcher: [
    '/((?!api|i/|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|apple-icon|icon).*)',
  ],
};
