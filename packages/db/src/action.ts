import { count } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import type { Db, Queryable } from './client';
import { rateRules, type Limiter } from './ratelimit';
import { withTenant, type TenantTable } from './tenant';

/** What every Server Action returns. `messageKey` is translated on the client (`errors.*` in the app messages). */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: string; messageKey: string; fields?: string[] };
    };

/** Throw from a handler to return a translated error instead of a crash. */
export class ActionError extends Error {
  constructor(
    readonly code: string,
    readonly messageKey: string,
  ) {
    super(code);
    this.name = 'ActionError';
  }
}

/** Blocks a write once the tenant has `max` rows in `table` (platform §6.3 row caps). */
export async function assertRowCap(
  db: Queryable,
  table: TenantTable,
  tenantId: string,
  max: number,
): Promise<void> {
  const [row] = await db
    .select({ n: count() })
    .from(table as PgTable)
    .where(withTenant(db, tenantId).where(table));
  if ((row?.n ?? 0) >= max) throw new ActionError('row_cap', 'errors.rowCap');
}

export type ActionContext = {
  db: Db;
  tenantId: string;
  sid: string;
  /** The demo role from the session (the app resolves its default when the visitor hasn't picked one). */
  role: string;
  ip: string | null;
};

export type ActionOptions = {
  /** Roles allowed to run the action; omitted = every role. */
  roles?: readonly string[];
  /** Writes count against the per-session and per-IP limits. Defaults to true. */
  write?: boolean;
};

function toInput(input: unknown): unknown {
  return input instanceof FormData ? Object.fromEntries(input) : input;
}

/**
 * Builds `defineAction` for an app. `resolveContext` reads the session (cookies/headers in Next) and the tenant;
 * it is injected so this package stays framework-free and testable.
 */
export function createActionFactory({
  resolveContext,
  limiter,
}: {
  resolveContext: () => Promise<ActionContext>;
  limiter: Limiter;
}) {
  return function defineAction<S extends z.ZodType, T>(
    schema: S,
    options: ActionOptions,
    handler: (input: z.output<S>, context: ActionContext) => Promise<T>,
  ) {
    return async (input: unknown): Promise<ActionResult<T>> => {
      const parsed = schema.safeParse(toInput(input));
      if (!parsed.success) {
        const fields = [
          ...new Set(
            parsed.error.issues
              .map((issue) => issue.path.join('.'))
              .filter(Boolean),
          ),
        ];
        return {
          ok: false,
          error: {
            code: 'invalid_input',
            messageKey: 'errors.invalidInput',
            fields,
          },
        };
      }
      try {
        const context = await resolveContext();
        if (options.roles && !options.roles.includes(context.role)) {
          return {
            ok: false,
            error: { code: 'forbidden', messageKey: 'errors.forbidden' },
          };
        }
        if (options.write ?? true) {
          const checks = [
            limiter.limit(`session:${context.sid}`, rateRules.writesPerSession),
          ];
          if (context.ip)
            checks.push(
              limiter.limit(`ip:${context.ip}`, rateRules.writesPerIp),
            );
          if ((await Promise.all(checks)).some((result) => !result.success)) {
            return {
              ok: false,
              error: { code: 'rate_limited', messageKey: 'errors.rateLimited' },
            };
          }
        }
        return { ok: true, data: await handler(parsed.data, context) };
      } catch (error) {
        if (error instanceof ActionError) {
          return {
            ok: false,
            error: { code: error.code, messageKey: error.messageKey },
          };
        }
        console.error('[action] unexpected error', error);
        return {
          ok: false,
          error: { code: 'unexpected', messageKey: 'errors.unexpected' },
        };
      }
    };
  };
}
