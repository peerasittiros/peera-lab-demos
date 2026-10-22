import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ActionError, createActionFactory, type ActionContext } from './action';
import type { Db } from './client';
import { createLimiter, type Limiter } from './ratelimit';

const context: ActionContext = {
  db: {} as Db,
  tenantId: 't-1',
  sid: 's-1',
  role: 'staff',
  ip: '203.0.113.7',
};
const allowAll: Limiter = {
  limit: async (_key, rule) => ({
    success: true,
    remaining: rule.limit,
    reset: 0,
  }),
};
const schema = z.object({
  name: z.string().min(1),
  qty: z.coerce.number().int().positive(),
});

function factory(limiter: Limiter = allowAll) {
  return createActionFactory({ resolveContext: async () => context, limiter });
}

describe('defineAction', () => {
  it('returns ok with the handler result for valid input, from an object or FormData', async () => {
    const action = factory()(
      schema,
      {},
      async (input, ctx) => `${ctx.tenantId}:${input.name}x${input.qty}`,
    );
    expect(await action({ name: 'water', qty: 2 })).toEqual({
      ok: true,
      data: 't-1:waterx2',
    });

    const form = new FormData();
    form.set('name', 'ice');
    form.set('qty', '3');
    expect(await action(form)).toEqual({ ok: true, data: 't-1:icex3' });
  });

  it('returns invalid_input with the failing fields', async () => {
    const handler = vi.fn();
    const result = await factory()(schema, {}, handler)({ name: '', qty: -1 });
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid_input',
        messageKey: 'errors.invalidInput',
        fields: ['name', 'qty'],
      },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns forbidden for a role that may not run it', async () => {
    const result = await factory()(
      schema,
      { roles: ['owner'] },
      async () => 'x',
    )({ name: 'a', qty: 1 });
    expect(result).toEqual({
      ok: false,
      error: { code: 'forbidden', messageKey: 'errors.forbidden' },
    });
  });

  it('returns rate_limited when the session or the IP is over its limit', async () => {
    const keys: string[] = [];
    const limiter: Limiter = {
      limit: async (key, rule) => {
        keys.push(key);
        return {
          success: !key.startsWith('ip:'),
          remaining: 0,
          reset: rule.limit,
        };
      },
    };
    const result = await factory(limiter)(schema, {}, async () => 'x')({
      name: 'a',
      qty: 1,
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'rate_limited', messageKey: 'errors.rateLimited' },
    });
    expect(keys).toEqual(['session:s-1', 'ip:203.0.113.7']);
  });

  it('skips the limiter for reads', async () => {
    const limiter: Limiter = { limit: vi.fn() };
    const result = await factory(limiter)(
      schema,
      { write: false },
      async () => 'read',
    )({ name: 'a', qty: 1 });
    expect(result).toEqual({ ok: true, data: 'read' });
    expect(limiter.limit).not.toHaveBeenCalled();
  });

  it('turns ActionError into a translated error and hides unexpected ones', async () => {
    const define = factory();
    expect(
      await define(schema, {}, async () => {
        throw new ActionError('stock_below_zero', 'errors.stockBelowZero');
      })({ name: 'a', qty: 1 }),
    ).toEqual({
      ok: false,
      error: { code: 'stock_below_zero', messageKey: 'errors.stockBelowZero' },
    });

    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await define(schema, {}, async () => {
        throw new Error('db down');
      })({ name: 'a', qty: 1 }),
    ).toEqual({
      ok: false,
      error: { code: 'unexpected', messageKey: 'errors.unexpected' },
    });
    log.mockRestore();
  });
});

describe('createLimiter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is a no-op without Upstash variables outside production', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const limiter = createLimiter({ production: false });
    for (let i = 0; i < 100; i += 1) {
      expect(
        (await limiter.limit('session:x', { limit: 1, window: '1 m' })).success,
      ).toBe(true);
    }
  });

  it('refuses to start in production without them', () => {
    expect(() => createLimiter({ production: true })).toThrow(
      /UPSTASH_REDIS_REST_URL/,
    );
  });
});
