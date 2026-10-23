import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

// `test` includes the database tests (`*.int.test.ts`, like @peera/db): they need the Postgres from DATABASE_URL
// (Docker locally, a service container in CI). `test:integration` runs only those.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['messages/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
