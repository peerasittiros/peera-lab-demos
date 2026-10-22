import { defineConfig } from 'drizzle-kit';

// Platform tables only. Each app has its own drizzle config, schema and migrations folder.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/platform-schema.ts',
  out: './drizzle',
  schemaFilter: ['platform'],
});
