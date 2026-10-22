import { defineConfig } from 'vitest/config';

// Components run in jsdom; server files opt into Node with `// @vitest-environment node`.
// The server tests use the Postgres from DATABASE_URL, like @peera/db.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
