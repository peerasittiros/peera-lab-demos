import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig keeps JSX for Next (`preserve`); tests need it compiled.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
