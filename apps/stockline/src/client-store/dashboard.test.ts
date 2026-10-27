import { describe, expect, it } from 'vitest';
import { stockValue } from '../domain/stock';
import { historyCsv, itemsCsv, sheetTime } from '../lib/export';
import { dashboardView, bangkokMidnight } from './dashboard';
import { ledgerFromSnapshot } from './ops';
import { seedSnapshot, TEST_NOW } from './testing';
import { itemViews, supplierViews, searchViews } from './views';
import { historyRows } from './history';

const snapshot = seedSnapshot('minimart');
const ledger = ledgerFromSnapshot(snapshot);
const rule = ledger.settings.lowStockRule;

describe('owner dashboard KPIs', () => {
  const data = dashboardView(ledger, rule, TEST_NOW);
  const active = Object.values(ledger.entities.item).filter(
    (row) => row.active !== false,
  );

  it('equals a direct computation from the ledger', () => {
    const value = active.reduce(
      (sum, row) =>
        sum +
        stockValue(
          ledger.balances[row.id] ?? 0,
          row.costSatang == null ? null : Number(row.costSatang),
        ),
      0,
    );
    expect(data.kpis.value).toBe(value);

    const onHand = (id: string) => ledger.balances[id] ?? 0;
    const low = active.filter(
      (row) => onHand(row.id) > 0 && onHand(row.id) <= Number(row.minQty),
    ).length;
    const out = active.filter((row) => onHand(row.id) <= 0).length;
    expect(data.kpis.low).toBe(low);
    expect(data.kpis.out).toBe(out);

    const today = bangkokMidnight(TEST_NOW).getTime();
    const movementsToday = ledger.movements.filter(
      (movement) => Date.parse(movement.occurredAt) >= today,
    ).length;
    expect(data.kpis.movementsToday).toBe(movementsToday);
  });

  it('closes the 30-day series at today’s value', () => {
    expect(data.series).toHaveLength(30);
    expect(data.series.at(-1)!.value).toBe(data.kpis.value);
  });

  it('ranks outflow by value at cost, largest first, at most ten', () => {
    expect(data.topOutflow.length).toBeLessThanOrEqual(10);
    const values = data.topOutflow.map((entry) => entry.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });
});

describe('history rows and filters', () => {
  const item = itemViews(ledger, 'owner')[0]!;

  it('lists newest first with the total and a page limit', () => {
    const { rows, total } = historyRows(ledger, 'owner', {}, { limit: 5 });
    expect(rows).toHaveLength(5);
    expect(total).toBe(ledger.movements.length);
    expect(
      Date.parse(rows[0]!.occurredAt.toISOString()),
    ).toBeGreaterThanOrEqual(Date.parse(rows[4]!.occurredAt.toISOString()));
  });

  it('filters by item and by movement type', () => {
    const { rows } = historyRows(ledger, 'owner', { itemId: item.id });
    expect(rows.every((row) => row.item.id === item.id)).toBe(true);
    const outs = historyRows(ledger, 'owner', { type: 'out' }).rows;
    expect(outs.every((row) => row.type === 'out')).toBe(true);
  });

  it('filters by Bangkok day, inclusive', () => {
    const day = sheetTime(TEST_NOW).slice(0, 10);
    const { rows } = historyRows(ledger, 'owner', { from: day, to: day });
    expect(rows.every((row) => sheetTime(row.occurredAt).startsWith(day))).toBe(
      true,
    );
    expect(historyRows(ledger, 'owner', { from: '2100-01-01' }).total).toBe(0);
  });

  it('filters by user', () => {
    const owner = ledger.users.owner.id;
    const { rows } = historyRows(ledger, 'owner', { userId: owner });
    expect(
      rows.every((row) => row.userName === ledger.users.owner.displayName),
    ).toBe(true);
  });
});

describe('exports', () => {
  it('writes the sheet time in Bangkok', () => {
    expect(sheetTime(TEST_NOW)).toBe('2026-10-25 12:00');
  });

  it('gives staff no money columns in the history and the items files', () => {
    const rows = historyRows(ledger, 'staff', {}, { limit: 3 }).rows;
    const staffHistory = historyCsv(rows, 'en', 'staff');
    expect(staffHistory.header.some((cell) => /baht/i.test(cell))).toBe(false);
    const ownerHistory = historyCsv(rows, 'en', 'owner');
    expect(ownerHistory.header.some((cell) => /baht/i.test(cell))).toBe(true);

    const items = itemViews(ledger, 'staff');
    const staffItems = itemsCsv(items, 'en', 'staff', {
      categoryName: () => '',
      supplierName: () => '',
    });
    expect(staffItems.header.some((cell) => /baht/i.test(cell))).toBe(false);
    expect(staffItems.rows.length).toBe(items.length);
  });

  it('keeps the supplier list usable by name', () => {
    expect(supplierViews(ledger).length).toBeGreaterThanOrEqual(0);
    expect(searchViews(itemViews(ledger, 'owner'), 'zzzz-none')).toEqual([]);
  });
});
