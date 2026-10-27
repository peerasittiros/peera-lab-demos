import { createDemoProxy } from '@peera/demo-kit/proxy';
import { env } from './src/env';

// Locale redirect + demo session (platform §6.2, Spec corrections 1–2). The tenant itself is created lazily by
// getDemoTenant() on the first server-side data access.
export const proxy = createDemoProxy({
  secret: () => env.DEMO_SESSION_SECRET,
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
