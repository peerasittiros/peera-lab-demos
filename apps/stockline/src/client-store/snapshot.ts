import { bangkokDay, bangkokWallTime, relativeTime } from './relativize';

// The snapshot is the template shop as of one Bangkok day, as plain JSON. The route builds it from the database
// (`readTemplateRows`) or, when the database is down, from the seed generator. Both go through `toSnapshot`, so
// the two sources have the same shape and the same dates.

export const SNAPSHOT_SCHEMA_VERSION = 1;

type Row = Record<string, unknown>;

/** Rows as the seed and the template tables hold them (camelCase, `Date` for timestamps). */
export type TemplateRows = {
  shopSettings: Row;
  units: Row[];
  categories: Row[];
  suppliers: Row[];
  users: Row[];
  items: Row[];
  itemUnits: Row[];
  orders: Row[];
  orderLines: Row[];
  countSessions: Row[];
  countLines: Row[];
  movements: Row[];
  balances: Row[];
  auditEvents: Row[];
};

export type Snapshot = TemplateRows & {
  schemaVersion: number;
  variant: string;
  /** The Bangkok day this snapshot's dates are relative to, `YYYY-MM-DD`. */
  snapshotDate: string;
  generatedAt: string;
};

/**
 * `clone_demo_tenant`'s rule for one timestamp: when the row has a relative day, use it; else keep the absolute
 * value. `capped` says whether the row uses `relative_time` (with the cap) or the plain wall time.
 */
function dated(
  now: Date,
  absolute: unknown,
  daysAgo: unknown,
  minute: number | null | undefined,
  capped: boolean,
): unknown {
  if (typeof daysAgo !== 'number') return absolute;
  return capped
    ? relativeTime(now, daysAgo, minute)
    : bangkokWallTime(now, daysAgo, minute ?? 600);
}

function withDates(row: Row, now: Date, fields: Record<string, unknown>): Row {
  return { ...row, ...fields };
}

/**
 * Columns the browser never reads: the tenant and row timestamps, and the relative-day inputs once the dates above
 * are applied. Dropping them takes about a quarter off the snapshot (most of it is movements), which the browser
 * parses and stores on every first visit of the day.
 */
const SERVER_ONLY = new Set([
  'tenantId',
  'createdAt',
  'updatedAt',
  'daysAgo',
  'minuteOfDay',
  'orderedDaysAgo',
  'expectedDaysAgo',
  'receivedDaysAgo',
]);

function forBrowser(row: Row): Row {
  const out: Row = {};
  for (const key in row) if (!SERVER_ONLY.has(key)) out[key] = row[key];
  return out;
}

/**
 * Applies the clone's date rules to every row, then turns the result into JSON. `now` is the instant the relative
 * dates are measured from.
 */
export function toSnapshot(
  rows: TemplateRows,
  variant: string,
  now: Date,
): Snapshot {
  const countDays = new Map<string, number | null>();
  for (const session of rows.countSessions)
    countDays.set(
      String(session.id),
      (session.daysAgo as number | null) ?? null,
    );

  const countSessions = rows.countSessions.map((session) => {
    const days = session.daysAgo as number | null | undefined;
    return withDates(session, now, {
      startedAt: dated(now, session.startedAt, days, 540, true),
      submittedAt:
        days == null || session.submittedAt == null
          ? session.submittedAt
          : relativeTime(now, days, 660),
      approvedAt:
        days == null || session.approvedAt == null
          ? session.approvedAt
          : relativeTime(now, days, 1020),
    });
  });

  const countLines = rows.countLines.map((line) => {
    const days = countDays.get(String(line.countSessionId)) ?? null;
    return withDates(line, now, {
      countedAt:
        days == null || line.countedAt == null
          ? line.countedAt
          : relativeTime(now, days, 600),
    });
  });

  const orders = rows.orders.map((order) =>
    withDates(order, now, {
      orderedAt: dated(now, order.orderedAt, order.orderedDaysAgo, 600, true),
      expectedAt: dated(
        now,
        order.expectedAt,
        order.expectedDaysAgo,
        600,
        false,
      ),
      receivedAt: dated(
        now,
        order.receivedAt,
        order.receivedDaysAgo,
        660,
        true,
      ),
    }),
  );

  const movements = rows.movements.map((movement) =>
    withDates(movement, now, {
      occurredAt: dated(
        now,
        movement.occurredAt,
        movement.daysAgo,
        movement.minuteOfDay as number,
        true,
      ),
    }),
  );

  const auditEvents = rows.auditEvents.map((event) =>
    withDates(event, now, {
      at: dated(
        now,
        event.at,
        event.daysAgo,
        event.minuteOfDay as number,
        true,
      ),
    }),
  );

  const tables: TemplateRows = {
    ...rows,
    countSessions,
    countLines,
    orders,
    movements,
    auditEvents,
  };
  const snapshot: Snapshot = {
    shopSettings: forBrowser(tables.shopSettings),
    units: tables.units.map(forBrowser),
    categories: tables.categories.map(forBrowser),
    suppliers: tables.suppliers.map(forBrowser),
    users: tables.users.map(forBrowser),
    items: tables.items.map(forBrowser),
    itemUnits: tables.itemUnits.map(forBrowser),
    orders: tables.orders.map(forBrowser),
    orderLines: tables.orderLines.map(forBrowser),
    countSessions: tables.countSessions.map(forBrowser),
    countLines: tables.countLines.map(forBrowser),
    movements: tables.movements.map(forBrowser),
    balances: tables.balances.map(forBrowser),
    auditEvents: tables.auditEvents.map(forBrowser),
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    variant,
    snapshotDate: bangkokDay(now),
    generatedAt: now.toISOString(),
  };
  // JSON round trip: dates become ISO strings and the result holds plain data only, as it does on the wire.
  return JSON.parse(JSON.stringify(snapshot)) as Snapshot;
}
