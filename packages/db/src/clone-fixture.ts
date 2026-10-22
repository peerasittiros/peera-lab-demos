// Test-only: a tiny app schema built from sql/clone-template.sql, used by the db package's integration tests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { integer, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { Db } from './client';
import type { DemoAppConfig } from './demo-tenant';

const schema = pgSchema('demo_clone');
export const fixtureItem = schema.table('item', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  parentId: uuid('parent_id'),
  name: text('name').notNull(),
  daysAgo: integer('days_ago').notNull(),
  minutesFromOpen: integer('minutes_from_open'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }),
});

export const FIXTURE_TEMPLATE = '00000000-0000-0000-0000-000000000001';

export const fixtureConfig: DemoAppConfig = {
  app: 'clone-test',
  schema: 'demo_clone',
  templates: { minimart: FIXTURE_TEMPLATE },
  defaultVariant: 'minimart',
};

/** Creates `demo_clone.item`, installs the clone template's functions for it, and seeds the template tenant. */
export async function setupCloneFixture(db: Db): Promise<void> {
  await db.execute(sql`create schema demo_clone`);
  await db.execute(sql`
    create table demo_clone.item (
      id uuid primary key,
      tenant_id uuid not null,
      parent_id uuid references demo_clone.item(id),
      name text not null,
      days_ago int not null,
      minutes_from_open int,
      occurred_at timestamptz
    )`);
  const template = readFileSync(
    fileURLToPath(new URL('../sql/clone-template.sql', import.meta.url)),
    'utf8',
  )
    .replaceAll('{{schema}}', 'demo_clone')
    .replaceAll('{{table}}', 'item');
  await db.execute(sql.raw(template));
  await db.insert(fixtureItem).values([
    {
      id: '10000000-0000-4000-8000-000000000001',
      tenantId: FIXTURE_TEMPLATE,
      name: 'Drinks',
      daysAgo: 0,
      minutesFromOpen: 30,
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      tenantId: FIXTURE_TEMPLATE,
      parentId: '10000000-0000-4000-8000-000000000001',
      name: 'Water 600 ml',
      daysAgo: 3,
      minutesFromOpen: 90,
    },
  ]);
}
