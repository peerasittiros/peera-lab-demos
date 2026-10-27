import { defineEnv } from '@peera/config/env';
import { z } from 'zod';

/** db:* scripts only need the connection string (from the shell or .env.local). */
export const scriptEnv = defineEnv(z.object({ DATABASE_URL: z.url() }));
