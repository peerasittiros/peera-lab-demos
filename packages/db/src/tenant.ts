import { and, eq, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Queryable } from './client';

/** A table scoped to a demo tenant: it has a `tenantId` column (`tenant_id uuid not null`). */
export type TenantTable = PgTable & { tenantId: PgColumn };

/**
 * Tenant-scoped query helpers. App code reads and writes tenant tables only through these, so every query carries
 * `tenant_id = $tenantId` (the `@peera/no-raw-db` lint rule flags raw `db.select()` and friends in apps).
 *
 * For joins and other queries the helpers don't cover, build the condition with `where(table, …)` and pass the
 * result to the raw builder in a line marked with an eslint-disable comment that says why.
 */
export function withTenant(db: Queryable, tenantId: string) {
  const scope = (table: TenantTable, ...conditions: (SQL | undefined)[]) =>
    and(eq(table.tenantId, tenantId), ...conditions) as SQL;

  return {
    tenantId,
    /** `tenant_id = $tenantId AND …conditions`, for queries built by hand. */
    where: scope,
    /** Rows keep the table's types (`T['$inferSelect']`); chain `.orderBy()`, `.limit()`, `.for('update')`. */
    select<T extends TenantTable>(table: T, where?: SQL) {
      return (
        db
          .select()
          // The explicit type argument keeps T (typed rows); `never` passes Drizzle's conditional parameter check, which
          // can't be decided for a generic table.
          .from<T & PgTable>(table as never)
          .where(scope(table, where))
      );
    },
    insert<T extends TenantTable>(
      table: T,
      values:
        | Omit<T['$inferInsert'], 'tenantId'>
        | Omit<T['$inferInsert'], 'tenantId'>[],
    ) {
      const rows = (Array.isArray(values) ? values : [values]).map((row) => ({
        ...row,
        tenantId,
      }));
      return db.insert(table).values(rows as T['$inferInsert'][]);
    },
    update<T extends TenantTable>(
      table: T,
      set: Partial<Omit<T['$inferInsert'], 'tenantId'>>,
      where?: SQL,
    ) {
      return db
        .update(table)
        .set(set as T['$inferInsert'])
        .where(scope(table, where));
    },
    delete<T extends TenantTable>(table: T, where?: SQL) {
      return db.delete(table).where(scope(table, where));
    },
  };
}

export type TenantScope = ReturnType<typeof withTenant>;
