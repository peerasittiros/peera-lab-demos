import { defineConfig } from 'vitest/config';

export default defineConfig({
  // @peera/i18n's entry re-exports TSX (kept as `preserve` for Next); tests need it compiled.
  oxc: { jsx: { runtime: 'automatic' } },
  test: { environment: 'node', include: ['messages/**/*.test.ts'] },
});
