import { createTestDb, type TestDb } from '@peera/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stocklineMigrations } from '../db/migrations';
import { readTemplateRows } from '../db/queries/snapshot';
import { buildSeedVariant } from '../db/seed/generator';
import { insertSeed } from '../db/seed/insert';
import { relativeTime } from './relativize';
import { toSnapshot } from './snapshot';

// The TypeScript port must equal `stockline.relative_time` (the SQL the clone uses) for the same instant.
// Postgres's now() is the transaction start, so the test reads it back and measures the port from that instant.

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb([stocklineMigrations]);
});

afterAll(async () => {
  await testDb?.cleanup();
});

const cases: [number, number | null][] = [
  [0, 600],
  [0, 540],
  [0, 1020],
  [0, null],
  [1, 600],
  [2, 660],
  [30, 540],
  [365, 600],
];

describe('relativeTime against stockline.relative_time', () => {
  it.each(cases)('days_ago %i, minute %s', async (daysAgo, minute) => {
    const result = await testDb.db.execute(
      sql`select now() as n, stockline.relative_time(${daysAgo}, ${minute}) as t`,
    );
    const [row] = result.rows as { n: Date; t: Date }[];
    const port = relativeTime(new Date(row!.n), daysAgo, minute);
    expect(port.toISOString()).toBe(new Date(row!.t).toISOString());
  });
});

describe('the snapshot read from the database', () => {
  it('has the same rows as the seed it was written from', async () => {
    const seed = buildSeedVariant('cafe');
    await testDb.db.transaction((tx) => insertSeed(tx, seed));

    const rows = await readTemplateRows(testDb.db, seed.tenantId);
    const snapshot = toSnapshot(rows, 'cafe', new Date());
    expect(snapshot.movements).toHaveLength(seed.movements.length);
    expect(snapshot.items).toHaveLength(seed.items.length);
    expect(snapshot.countLines).toHaveLength(seed.countLines.length);
  });
});
