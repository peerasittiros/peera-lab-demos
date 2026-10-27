import { describe, expect, it } from 'vitest';
import { buildSeedVariant, STOCKLINE_VARIANTS } from '../db/seed/generator';
import { seedSnapshot, TEST_NOW } from './testing';
import { forRole, SNAPSHOT_SCHEMA_VERSION, toSnapshot } from './snapshot';

describe('toSnapshot', () => {
  it.each(STOCKLINE_VARIANTS)(
    'builds the %s shop as JSON, dated today in Bangkok',
    (variant) => {
      const snapshot = seedSnapshot(variant);
      expect(snapshot.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
      expect(snapshot.variant).toBe(variant);
      expect(snapshot.snapshotDate).toBe('2026-10-25');
      // Survives a JSON round trip unchanged: plain data only.
      expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    },
  );

  it('never places a template movement after now', () => {
    const { movements } = seedSnapshot('cafe');
    const latest = Math.max(
      ...movements.map((row) => Date.parse(String(row.occurredAt))),
    );
    expect(latest).toBeLessThanOrEqual(TEST_NOW.getTime());
  });

  it('keeps every seed row', () => {
    const seed = buildSeedVariant('hardware');
    const snapshot = toSnapshot(seed, 'hardware', TEST_NOW);
    expect(snapshot.movements).toHaveLength(seed.movements.length);
    expect(snapshot.items).toHaveLength(seed.items.length);
    expect(snapshot.balances).toHaveLength(seed.balances.length);
  });

  it('moves the dates of a day-relative row to that day', () => {
    const seed = buildSeedVariant('minimart');
    const withDay = seed.movements.find(
      (row) => typeof row.daysAgo === 'number' && row.daysAgo >= 2,
    );
    expect(withDay).toBeDefined();
    const snapshot = toSnapshot(seed, 'minimart', TEST_NOW);
    const moved = snapshot.movements.find((row) => row.id === withDay!.id);
    const day = new Date(String(moved!.occurredAt)).toLocaleDateString(
      'en-CA',
      { timeZone: 'Asia/Bangkok' },
    );
    const expected = new Date(
      Date.UTC(2026, 9, 25 - (withDay!.daysAgo as number)),
    )
      .toISOString()
      .slice(0, 10);
    expect(day).toBe(expected);
  });
});

describe('forRole', () => {
  const money = /"(costSatang|priceSatang|unitCostSatang)"/;

  it('gives the owner every column, marked as the owner copy', () => {
    const snapshot = seedSnapshot('minimart');
    const owner = forRole(snapshot, 'owner');
    expect(owner.role).toBe('owner');
    expect(owner.items).toEqual(snapshot.items);
    expect(JSON.stringify(owner)).toMatch(money);
  });

  it.each(STOCKLINE_VARIANTS)(
    'gives staff no money anywhere in the %s shop',
    (variant) => {
      const staff = forRole(seedSnapshot(variant), 'staff');
      expect(staff.role).toBe('staff');
      expect(JSON.stringify(staff)).not.toMatch(money);
    },
  );

  it('keeps every row staff may see', () => {
    const snapshot = seedSnapshot('minimart');
    const staff = forRole(snapshot, 'staff');
    expect(staff.items).toHaveLength(snapshot.items.length);
    expect(staff.movements).toHaveLength(snapshot.movements.length);
    expect(staff.items[0]!.sku).toBe(snapshot.items[0]!.sku);
  });
});
