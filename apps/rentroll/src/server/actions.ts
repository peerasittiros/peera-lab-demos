import { createActionFactory, createLimiter } from '@peera/db';
import { env } from '../env';
import { getContext } from './context';

/**
 * `defineAction(schema, { roles, write }, handler)` for Rentroll Server Actions (01 §6.2): Zod input, role check,
 * rate limits, typed `{ ok, data } | { ok: false, error: { code, messageKey } }` results.
 */
export const defineAction = createActionFactory({
  resolveContext: async () => {
    const context = await getContext();
    return {
      db: context.db,
      tenantId: context.tenantId,
      sid: context.sid,
      role: context.role,
      ip: context.ip,
    };
  },
  limiter: createLimiter({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
    prefix: 'rentroll',
    // Required wherever the demo is public (Vercel). A local `next start` runs without Redis.
    production: process.env.VERCEL === '1',
  }),
});

/** Row caps per tenant (platform §6.3). */
export const ROW_CAPS = {
  rooms: 200,
  roomTypes: 30,
  ratePlans: 200,
  contracts: 500,
} as const;
