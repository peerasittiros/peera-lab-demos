import { defineEnv, sharedEnvSchema } from '@peera/config/env';

export const env = defineEnv(sharedEnvSchema);

if (env.DB_SCHEMA !== 'rentroll') {
  throw new Error('DB_SCHEMA must be "rentroll" for the Rentroll app');
}
