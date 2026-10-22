import { defineConfig, devices } from '@playwright/test';

// Chromium and WebKit (platform §8). The app runs as a production build on :3010; the embed test frames it from
// a host page on 127.0.0.1 (a different site), served by a small HTTP server in @peera/test-utils.
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:3010', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npx next build && npx next start -p 3010',
    url: 'http://localhost:3010/th',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
