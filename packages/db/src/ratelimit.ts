import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type Unit = 's' | 'm' | 'h' | 'd';
export type RateRule = { limit: number; window: `${number} ${Unit}` };

/** Platform §6.3. Apps add their own (e.g. per-feature) rules next to these. */
export const rateRules = {
  writesPerSession: { limit: 60, window: '1 m' },
  writesPerIp: { limit: 300, window: '1 h' },
} satisfies Record<string, RateRule>;

export type RateResult = { success: boolean; remaining: number; reset: number };
export type Limiter = {
  limit: (key: string, rule: RateRule) => Promise<RateResult>;
};

export type LimiterOptions = {
  url?: string;
  token?: string;
  /** Defaults to NODE_ENV === 'production'. */
  production?: boolean;
  prefix?: string;
};

let warned = false;

/**
 * Upstash sliding-window limiter. Without the Upstash variables it is a no-op (everything allowed, one warning)
 * outside production, so dev and tests need no Redis; in production it refuses to start without them.
 */
export function createLimiter({
  url,
  token,
  production = process.env.NODE_ENV === 'production',
  prefix = 'peera',
}: LimiterOptions): Limiter {
  if (!url || !token) {
    if (production) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production (rate limits).',
      );
    }
    if (!warned) {
      console.warn(
        '[rate-limit] Upstash variables missing: rate limiting is off (dev only).',
      );
      warned = true;
    }
    return {
      limit: async (_key, rule) => ({
        success: true,
        remaining: rule.limit,
        reset: 0,
      }),
    };
  }

  const redis = new Redis({ url, token });
  const limiters = new Map<string, Ratelimit>();
  return {
    async limit(key, rule) {
      const id = `${rule.limit}/${rule.window}`;
      let limiter = limiters.get(id);
      if (!limiter) {
        limiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
          prefix: `${prefix}:${id}`,
        });
        limiters.set(id, limiter);
      }
      const { success, remaining, reset } = await limiter.limit(key);
      return { success, remaining, reset };
    },
  };
}
