import { describe, expect, it } from 'vitest';
import { ledgerFromSnapshot } from './ops';
import { seedSnapshot } from './testing';
import {
  findByCode,
  itemViews,
  lowViews,
  recentViews,
  sampleCode,
  searchViews,
} from './views';

const snapshot = seedSnapshot('minimart');
const ledger = ledgerFromSnapshot(snapshot);

describe('itemViews', () => {
  it('lists the active items with balance, status and units', () => {
    const views = itemViews(ledger, 'owner');
    expect(views).toHaveLength(
      snapshot.items.filter((row) => row.active !== false).length,
    );
    const first = views[0]!;
    expect(first.onHand).toBe(ledger.balances[first.id]);
    expect(first.baseUnit.id).toBeTruthy();
  });

  it('removes cost and price for staff', () => {
    const staff = itemViews(ledger, 'staff');
    expect(
      staff.every(
        (view) => !('costSatang' in view) && !('priceSatang' in view),
      ),
    ).toBe(true);
    const owner = itemViews(ledger, 'owner');
    expect(owner.some((view) => 'costSatang' in view)).toBe(true);
  });

  it('includes the pack units of an item', () => {
    const packed = snapshot.itemUnits[0];
    expect(packed).toBeDefined();
    const view = itemViews(ledger, 'owner').find(
      (entry) => entry.id === String(packed!.itemId),
    );
    expect(
      view!.packs.some((pack) => pack.unitId === String(packed!.unitId)),
    ).toBe(true);
  });
});

describe('searchViews', () => {
  const views = itemViews(ledger, 'owner');

  it('returns nothing for a blank query', () => {
    expect(searchViews(views, '   ')).toEqual([]);
  });

  it('finds an exact SKU first', () => {
    const target = views[3]!;
    expect(searchViews(views, target.sku.toLowerCase())[0]?.id).toBe(target.id);
  });

  it('finds a Thai name by its start', () => {
    const target = views[5]!;
    const prefix = target.nameTh.slice(0, 3);
    const found = searchViews(views, prefix);
    expect(found.some((view) => view.id === target.id)).toBe(true);
  });

  it('caps the results at 20', () => {
    expect(searchViews(views, 'a', 20).length).toBeLessThanOrEqual(20);
  });
});

describe('lowViews and recentViews', () => {
  it('puts out-of-stock first, then low', () => {
    const low = lowViews(itemViews(ledger, 'owner'));
    const order = low.map((view) => view.status);
    const firstLow = order.indexOf('low');
    const lastOut = order.lastIndexOf('out');
    if (firstLow >= 0 && lastOut >= 0) expect(lastOut).toBeLessThan(firstLow);
    expect(low.every((view) => view.status !== 'ok')).toBe(true);
  });

  it('keeps the order of the given ids and skips unknown ones', () => {
    const views = itemViews(ledger, 'owner');
    const [a, b] = views;
    const recent = recentViews(views, [b!.id, 'unknown', a!.id]);
    expect(recent.map((view) => view.id)).toEqual([b!.id, a!.id]);
  });
});

describe('findByCode and sampleCode', () => {
  const views = itemViews(ledger, 'owner');
  const withBarcode = views.find((view) => view.barcode)!;

  it('finds an item by its barcode, and by its SKU in any case', () => {
    expect(findByCode(views, withBarcode.barcode!)?.id).toBe(withBarcode.id);
    expect(findByCode(views, `  ${withBarcode.sku.toLowerCase()} `)?.id).toBe(
      withBarcode.id,
    );
  });

  it('returns null for a code no item has', () => {
    expect(findByCode(views, '9990000000005')).toBeNull();
    expect(findByCode(views, '  ')).toBeNull();
  });

  it('samples a barcode from the shop, and none when there is none', () => {
    expect(sampleCode(views, () => 0)).toBe(
      views.find((view) => view.barcode)!.barcode,
    );
    expect(
      sampleCode(views.map((view) => ({ ...view, barcode: null }))),
    ).toBeNull();
  });
});
