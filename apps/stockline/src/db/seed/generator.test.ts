import { describe, expect, it } from 'vitest';
import { itemStatus } from '../../domain/stock';
import { buildSeedVariant, ean13, STOCKLINE_VARIANTS } from './generator';

const expectedItems = { minimart: 80, cafe: 45, hardware: 60 };

describe.each(STOCKLINE_VARIANTS)('seed variant %s', (variant) => {
  const seed = buildSeedVariant(variant);

  it('is deterministic', () => {
    expect(buildSeedVariant(variant)).toEqual(seed);
  });

  it('has the item and supplier counts from 02 §9', () => {
    expect(seed.items).toHaveLength(expectedItems[variant]);
    expect(seed.suppliers.length).toBeGreaterThanOrEqual(3);
    expect(seed.suppliers.length).toBeLessThanOrEqual(5);
    expect(new Set(seed.items.map((row) => row.sku)).size).toBe(
      seed.items.length,
    );
    expect(new Set(seed.items.map((row) => row.barcode)).size).toBe(
      seed.items.length,
    );
  });

  it('names every catalog record in Thai and English', () => {
    for (const row of [...seed.items, ...seed.categories, ...seed.units]) {
      expect(row.nameTh.trim()).not.toBe('');
      expect(row.nameEn?.trim()).toBeTruthy();
    }
  });

  it('keeps every balance equal to its ledger, in time order, never below zero', () => {
    for (const balance of seed.balances) {
      const rows = seed.movements.filter(
        (row) => row.itemId === balance.itemId,
      );
      const total = rows.reduce((sum, row) => sum + row.quantityBase, 0);
      expect(total).toBe(balance.onHand);
      expect(balance.onHand).toBeGreaterThanOrEqual(0);
      const ordered = [...rows].sort(
        (a, b) => b.daysAgo - a.daysAgo || a.minuteOfDay - b.minuteOfDay,
      );
      let running = 0;
      for (const row of ordered) {
        running += row.quantityBase;
        expect(row.balanceAfter).toBe(running);
      }
    }
  });

  it('covers 60 days and stays well under the 2,000-movement cap', () => {
    const days = seed.movements.map((row) => row.daysAgo);
    expect(Math.max(...days)).toBe(59);
    expect(Math.min(...days)).toBe(0);
    expect(seed.movements.length).toBeGreaterThan(seed.items.length * 4);
    expect(seed.movements.length).toBeLessThan(1_300);
  });

  it('leaves 8–12 items at or under min, at least one out of stock', () => {
    const minById = new Map(seed.items.map((row) => [row.id, row.minQty]));
    const statuses = seed.balances.map((row) =>
      itemStatus(row.onHand, minById.get(row.itemId)!),
    );
    const low = statuses.filter((status) => status !== 'ok').length;
    expect(low).toBeGreaterThanOrEqual(8);
    expect(low).toBeLessThanOrEqual(12);
    expect(statuses).toContain('out');
  });

  it('has one approved count with small shrinkage', () => {
    expect(seed.countSessions).toHaveLength(1);
    expect(seed.countSessions[0]!.status).toBe('approved');
    const differences = seed.countLines.filter(
      (row) => row.counted !== row.expected,
    );
    expect(differences.length).toBeGreaterThan(0);
    const adjustments = seed.movements.filter((row) => row.reason === 'count');
    expect(adjustments).toHaveLength(differences.length);
  });

  it('has exactly one purchase order still waiting to be received', () => {
    const waiting = seed.orders.filter((row) => row.status === 'ordered');
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.expectedDaysAgo).toBeLessThan(0);
    const lines = seed.orderLines.filter(
      (row) => row.purchaseOrderId === waiting[0]!.id,
    );
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((row) => row.receivedBase === 0)).toBe(true);
  });

  it('matches each received purchase order with its in movements', () => {
    for (const order of seed.orders.filter(
      (row) => row.status === 'received',
    )) {
      const lines = seed.orderLines.filter(
        (row) => row.purchaseOrderId === order.id,
      );
      const received = seed.movements.filter(
        (row) => row.purchaseOrderId === order.id,
      );
      expect(received.map((row) => row.quantityBase).sort()).toEqual(
        lines.map((row) => row.qtyBase).sort(),
      );
    }
  });
});

describe('ean13', () => {
  it('produces valid in-store EAN-13 codes', () => {
    const code = ean13(0, 0);
    expect(code).toMatch(/^2\d{12}$/);
    const digits = [...code].map(Number);
    const sum = digits
      .slice(0, 12)
      .reduce((total, digit, index) => total + digit * (index % 2 ? 3 : 1), 0);
    expect((10 - (sum % 10)) % 10).toBe(digits[12]);
  });
});
