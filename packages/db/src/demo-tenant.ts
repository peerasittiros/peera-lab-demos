import { and, eq, sql } from 'drizzle-orm';
import type { Queryable, Db } from './client';
import { demoSession, event, mockMessage } from './platform-schema';

/**
 * How an app plugs into the demo sandbox. The app's migration defines, in its own schema, the SQL functions
 * `<schema>.clone_demo_tenant(template uuid, target uuid)` and `<schema>.delete_demo_tenant(target uuid)`,
 * written from `sql/clone-template.sql`.
 */
export type DemoAppConfig = {
  /** App slug, e.g. `stockline`. */
  app: string;
  /** Postgres schema holding the app's tables and its clone/delete functions. */
  schema: string;
  /** Template tenant id per seed variant (`?variant=`), e.g. `{ minimart: '00000000-…-0001' }`. */
  templates: Record<string, string>;
  defaultVariant: string;
};

export type DemoTenant = {
  tenantId: string;
  variant: string;
  locale: string;
  role: string | null;
  /** True when this call created the session and cloned the template. */
  created: boolean;
};

function fn(
  config: DemoAppConfig,
  name: 'clone_demo_tenant' | 'delete_demo_tenant',
) {
  return sql`${sql.identifier(config.schema)}.${sql.identifier(name)}`;
}

async function cloneInto(
  tx: Queryable,
  config: DemoAppConfig,
  variant: string,
  tenantId: string,
) {
  const template = config.templates[variant];
  if (!template)
    throw new Error(
      `[demo] ${config.app}: no template tenant for variant "${variant}"`,
    );
  await tx.execute(
    sql`select ${fn(config, 'clone_demo_tenant')}(${template}::uuid, ${tenantId}::uuid)`,
  );
}

/** Deletes everything a tenant owns: the app's rows (its delete function) and the platform's events and messages. */
export async function removeTenantData(
  tx: Queryable,
  config: DemoAppConfig,
  tenantId: string,
): Promise<void> {
  await tx.execute(
    sql`select ${fn(config, 'delete_demo_tenant')}(${tenantId}::uuid)`,
  );
  await tx.delete(event).where(eq(event.tenantId, tenantId));
  await tx.delete(mockMessage).where(eq(mockMessage.tenantId, tenantId));
}

/**
 * The visitor's sandbox tenant, created on first use. Session row and clone happen in one transaction. Parallel
 * first requests for one session all get the same tenant: the second insert waits on the primary key until the
 * first commits, does nothing, and reads the committed row.
 */
export async function getDemoTenant(
  db: Db,
  config: DemoAppConfig,
  {
    sid,
    variant,
    locale = 'th',
  }: { sid: string; variant?: string | null; locale?: string },
): Promise<DemoTenant> {
  const chosen =
    variant && config.templates[variant] ? variant : config.defaultVariant;
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(demoSession)
      .values({
        app: config.app,
        id: sid,
        tenantId: crypto.randomUUID(),
        variant: chosen,
        locale,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      await cloneInto(tx, config, chosen, inserted.tenantId);
      return {
        tenantId: inserted.tenantId,
        variant: chosen,
        locale,
        role: null,
        created: true,
      };
    }
    const [row] = await tx
      .select()
      .from(demoSession)
      .where(and(eq(demoSession.app, config.app), eq(demoSession.id, sid)));
    if (!row)
      throw new Error(
        `[demo] ${config.app}: session ${sid} vanished during getDemoTenant`,
      );
    return {
      tenantId: row.tenantId,
      variant: row.variant,
      locale: row.locale,
      role: row.role,
      created: false,
    };
  });
}

/** Throws away the visitor's changes: deletes the tenant's data and clones the template again (same tenant id). */
export async function resetDemoTenant(
  db: Db,
  config: DemoAppConfig,
  { sid }: { sid: string },
): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(demoSession)
      .where(and(eq(demoSession.app, config.app), eq(demoSession.id, sid)))
      .for('update');
    if (!row)
      throw new Error(`[demo] ${config.app}: no session ${sid} to reset`);
    await removeTenantData(tx, config, row.tenantId);
    await cloneInto(tx, config, row.variant, row.tenantId);
    return row.tenantId;
  });
}

/** The demo role switcher writes here (no password). */
export async function setSessionRole(
  db: Db,
  config: DemoAppConfig,
  { sid, role }: { sid: string; role: string },
) {
  await db
    .update(demoSession)
    .set({ role })
    .where(and(eq(demoSession.app, config.app), eq(demoSession.id, sid)));
}
