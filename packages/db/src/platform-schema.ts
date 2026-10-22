import { sql } from 'drizzle-orm';
import {
  bigserial,
  index,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Shared tables used by every demo app. Tables are schema-qualified, so queries never depend on search_path. */
export const platform = pgSchema('platform');

/** One row per visitor per app. The visitor's sandbox tenant lives as long as this row (cleanup after 24 h). */
export const demoSession = platform.table(
  'demo_session',
  {
    app: text('app').notNull(),
    id: uuid('id').notNull(),
    tenantId: uuid('tenant_id').notNull(),
    variant: text('variant').notNull(),
    locale: text('locale').notNull().default('th'),
    role: text('role'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.app, t.id] }),
    index('demo_session_tenant_idx').on(t.tenantId),
    index('demo_session_created_idx').on(t.app, t.createdAt),
  ],
);

/** Messages the real system would send (LINE, email). Demos never send them; LineChatMock renders these. */
export const mockMessage = platform.table(
  'mock_message',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    channel: text('channel').notNull().default('line'),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('mock_message_tenant_idx').on(t.tenantId, t.id)],
);

/** Append-only feed of tenant events, read by the SSE stream (`id > Last-Event-ID`). */
export const event = platform.table(
  'event',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload')
      .notNull()
      .default(sql`'{}'::jsonb`),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('event_tenant_idx').on(t.tenantId, t.id)],
);
