import { defineConfig, devices } from '@playwright/test';

// Chromium and WebKit (platform §8) against a production build on :3012. The web server seeds the template tenant
// first, so every test starts from the same apartment; each browser context is a new visitor with its own sandbox
// tenant. Locally the app reads .env.local; CI passes the variables below.
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: 2,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: ci ? 'github' : 'list',
  use: { baseURL: 'http://localhost:3012', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command:
      'node --env-file-if-exists=.env.local --import tsx src/db/seed/run.ts && npx next build && npx next start -p 3012',
    url: 'http://localhost:3012/th',
    reuseExistingServer: !ci,
    timeout: 300_000,
    env: ci
      ? {
          DATABASE_URL:
            process.env.DATABASE_URL ?? 'postgres://postgres:dev@localhost:5432/demos',
          DB_SCHEMA: 'rentroll',
          DEMO_SESSION_SECRET: 'rentroll-playwright-session-secret-0123456789',
          ALLOWED_FRAME_ANCESTORS: 'http://localhost:3000 http://127.0.0.1:*',
          PEERA_LAB_URL: 'http://localhost:3000',
          CRON_SECRET: 'rentroll-playwright-cron-secret',
        }
      : undefined,
  },
});
