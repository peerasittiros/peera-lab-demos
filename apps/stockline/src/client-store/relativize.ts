// The template's relative times turned into real instants for "today" in Asia/Bangkok. This is a port of
// `stockline.relative_time` and the date rules in `stockline.clone_demo_tenant` (src/db/migrations/0001), so the
// snapshot route and the SQL clone agree. `relativize.int.test.ts` checks the two against each other.

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // Bangkok has no DST: a fixed +07:00.
const DAY_MINUTES = 1440;
const DEFAULT_MINUTE = 600; // 10:00, the clone's default when a row has no minute of day.

/** The Bangkok calendar day of an instant, as `YYYY-MM-DD`. */
export function bangkokDay(now: Date): string {
  return new Date(now.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Bangkok wall-clock time `daysAgo` days before the Bangkok day of `now`, at `minuteOfDay` past midnight, as an
 * instant. No cap: this is the rule for expected dates (`clone_demo_tenant` adds 10 hours to the date).
 */
export function bangkokWallTime(
  now: Date,
  daysAgo: number,
  minuteOfDay: number,
): Date {
  const [year = 1970, month = 1, day = 1] = bangkokDay(now)
    .split('-')
    .map(Number);
  // Date.UTC carries negative days and minutes over month and day boundaries, like Postgres intervals do.
  const wallAsUtc = Date.UTC(year, month - 1, day - daysAgo, 0, minuteOfDay);
  return new Date(wallAsUtc - BANGKOK_OFFSET_MS);
}

/**
 * A template row's relative time (`relative_time(days_ago, minute_of_day)`): the wall-clock time, capped so a
 * row never lands in the future. The cap is `now − (1440 − minute) seconds`, which keeps the order of rows that
 * share a day, as the SQL does.
 */
export function relativeTime(
  now: Date,
  daysAgo: number,
  minuteOfDay: number | null | undefined,
): Date {
  const minute = minuteOfDay ?? DEFAULT_MINUTE;
  const wall = bangkokWallTime(now, daysAgo, minute);
  const cap = new Date(now.getTime() - (DAY_MINUTES - minute) * 1000);
  return wall.getTime() < cap.getTime() ? wall : cap;
}
