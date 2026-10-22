import { createDemoProxy } from '@peera/demo-kit/proxy';

// kit-preview runs locally only, so a fixed fallback secret is fine here; real apps require DEMO_SESSION_SECRET.
export const proxy = createDemoProxy({
  secret: () =>
    process.env.DEMO_SESSION_SECRET ??
    'kit-preview-local-secret-not-for-production',
});

export const config = {
  // Skip Next internals, route handlers and any path with a file extension.
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
