import { configDefaults, defineConfig } from 'vitest/config';

// Unlike the other packages, `test` here includes the integration tests (`*.int.test.ts`): they need the
// Postgres from DATABASE_URL (Docker locally, a service container in CI) and fail loudly without it.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
