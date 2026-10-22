import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // Setting exclude replaces Vitest's defaults, so keep them (node_modules etc.) and add integration tests.
    exclude: [...configDefaults.exclude, '**/*.int.test.ts'],
  },
});
