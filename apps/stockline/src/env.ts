import { defineEnv, sharedEnvSchema } from '@peera/config/env';

export const env = defineEnv(sharedEnvSchema);

if (env.DB_SCHEMA !== 'stockline') {
  throw new Error('DB_SCHEMA must be "stockline" for the Stockline app');
}
