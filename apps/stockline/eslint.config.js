import next from '@peera/config/eslint/next';

// The base config scopes its app rules to `apps/**` from the repo root; this config lives in the app, so the
// same rules are switched on here with app-relative globs.
const config = [
  ...next,
  { ignores: ['test-results/**', 'playwright-report/**'] },
  {
    files: ['**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: { '@peera/no-literal-string': 'error' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/db/**', 'scripts/**', 'e2e/**', '**/*.test.{ts,tsx}'],
    rules: { '@peera/no-raw-db': 'error' },
  },
];

export default config;
