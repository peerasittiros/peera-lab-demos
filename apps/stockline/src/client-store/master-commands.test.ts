import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryPersistence } from './idb';
import {
  addCategory,
  addUnit,
  importRows,
  removeMasterRecord,
  saveItem,
  saveSettings,
  saveSupplier,
  setItemActive,
} from './master-commands';
import { createStore, type Store } from './store';
import { seedSnapshot, TEST_NOW } from './testing';
import { changeViews, filterItems, itemViews, searchViews } from './views';
import type { ImportRow } from '../domain/import';

let store: Store;

beforeEach(async () => {
  const snapshot = seedSnapshot('minimart');
  store = createStore({
    persistence: createMemoryPersistence(),
    fetchSnapshot: async () => snapshot,
    now: () => TEST_NOW,
    openChannel: () => null,
  });
  await store.load('minimart');
});

afterEach(() => store.close());

const ledger = () => store.getState().ledger!;
const snapshot = () => store.getState().snapshot!;
const unitId = () => String(snapshot().units[0]!.id);
const existingItem = () =>
  itemViews(ledger(), 'owner', { includeInactive: true })[0]!;

/** Owner input for an item: a Thai name, the base unit, and nothing else. */
function itemInput(overrides: Record<string, unknown> = {}) {
  return {
    nameTh: 'ทดสอบ',
    nameEn: 'Test item',
    sku: '',
    barcode: '',
    categoryId: null,
    baseUnitId: unitId(),
    packs: [],
    costBaht: 10,
    priceBaht: 15,
    minQty: 2,
    reorderQty: 5,
    supplierId: null,
    location: '',
    openingQty: 0,
    ...overrides,
  };
}

describe('saveItem', () => {
  it('creates an item with the next SKU and no stock', async () => {
    const result = await saveItem(store, itemInput(), 'owner', {
      now: () => TEST_NOW,
    });
    expect(result.ok).toBe(true);
    const created = itemViews(ledger(), 'owner').find(
      (view) => view.id === (result as { data: { id: string } }).data.id,
    );
    expect(created?.sku).toMatch(/^STK-\d{4}$/);
    expect(created?.onHand).toBe(0);
  });

  it('records the opening stock as an opening movement', async () => {
    const result = await saveItem(store, itemInput({ openingQty: 7 }), 'owner');
    const id = (result as { data: { id: string } }).data.id;
    expect(ledger().balances[id]).toBe(7);
    expect(ledger().movements.at(-1)).toMatchObject({
      reason: 'opening',
      quantityBase: 7,
      itemId: id,
    });
  });

  it('is owner only', async () => {
    const result = await saveItem(store, itemInput(), 'staff');
    expect(result).toEqual({
      ok: false,
      error: { code: 'forbidden', messageKey: 'errors.forbidden' },
    });
  });

  it('refuses a SKU or barcode another item has', async () => {
    const other = existingItem();
    const sku = await saveItem(store, itemInput({ sku: other.sku }), 'owner');
    expect(sku).toMatchObject({ ok: false, error: { code: 'sku_taken' } });
    if (other.barcode) {
      const barcode = await saveItem(
        store,
        itemInput({ barcode: other.barcode }),
        'owner',
      );
      expect(barcode).toMatchObject({
        ok: false,
        error: { code: 'barcode_taken' },
      });
    }
  });

  it('refuses a pack unit the shop does not have', async () => {
    const result = await saveItem(
      store,
      itemInput({ packs: [{ unitId: crypto.randomUUID(), factor: 12 }] }),
      'owner',
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
  });

  it('updates an item, keeps its balance, and replaces its packs', async () => {
    const target = existingItem();
    const before = ledger().balances[target.id];
    const result = await saveItem(
      store,
      itemInput({
        id: target.id,
        nameTh: 'เปลี่ยนชื่อ',
        sku: target.sku,
        packs: [],
      }),
      'owner',
      { now: () => TEST_NOW },
    );
    expect(result.ok).toBe(true);
    const updated = itemViews(ledger(), 'owner').find(
      (view) => view.id === target.id,
    )!;
    expect(updated.nameTh).toBe('เปลี่ยนชื่อ');
    expect(updated.onHand).toBe(before);
    expect(updated.packs).toEqual([]);
  });
});

describe('archive', () => {
  it('hides an archived item from the quick move list and brings it back', async () => {
    const target = existingItem();
    await setItemActive(store, target.id, false, 'owner');
    expect(
      itemViews(ledger(), 'owner').some((view) => view.id === target.id),
    ).toBe(false);
    expect(
      itemViews(ledger(), 'owner', { includeInactive: true }).some(
        (view) => view.id === target.id,
      ),
    ).toBe(true);
    await setItemActive(store, target.id, true, 'owner');
    expect(
      itemViews(ledger(), 'owner').some((view) => view.id === target.id),
    ).toBe(true);
  });

  it('shows archived items only when asked for', () => {
    const all = itemViews(ledger(), 'owner', { includeInactive: true });
    const archived = all.find((view) => view.id === existingItem().id)!;
    expect(
      filterItems([{ ...archived, active: false }], { archived: false }),
    ).toEqual([]);
    expect(
      filterItems([{ ...archived, active: false }], { archived: true }),
    ).toHaveLength(1);
  });
});

describe('suppliers and settings', () => {
  it('stores the phone in the storage format and rejects a bad one', async () => {
    const good = await saveSupplier(
      store,
      {
        name: 'ร้านใหม่',
        contactName: '',
        phone: '081-234-5678',
        lineId: '',
        leadTimeDays: 2,
        note: '',
      },
      'owner',
    );
    expect(good.ok).toBe(true);
    const supplier = Object.values(ledger().entities.supplier).find(
      (row) => row.name === 'ร้านใหม่',
    );
    expect(supplier?.phone).toBe('+66812345678');

    const bad = await saveSupplier(
      store,
      {
        name: 'x',
        contactName: '',
        phone: '12',
        lineId: '',
        leadTimeDays: 0,
        note: '',
      },
      'owner',
    );
    expect(bad).toMatchObject({ ok: false, error: { code: 'phone_invalid' } });
  });

  it('saves the shop settings', async () => {
    const result = await saveSettings(
      store,
      {
        shopNameTh: 'ร้านทดสอบ',
        shopNameEn: 'Test shop',
        lowStockRule: 'below_min',
        reorderWeekday: 3,
      },
      'owner',
    );
    expect(result.ok).toBe(true);
    expect(ledger().settings).toMatchObject({
      shopNameTh: 'ร้านทดสอบ',
      lowStockRule: 'below_min',
      reorderWeekday: 3,
    });
  });
});

describe('categories and units', () => {
  it('adds a category and removes it again', async () => {
    const added = await addCategory(
      store,
      { nameTh: 'ของทดสอบ', nameEn: '' },
      'owner',
    );
    expect(added.ok).toBe(true);
    const id = (added as { data: { id: string } }).data.id;
    expect(
      await removeMasterRecord(store, 'category', id, 'owner'),
    ).toMatchObject({ ok: true });
  });

  it('will not remove a category that items use', async () => {
    const categoryId = Object.values(ledger().entities.item).find(
      (row) => row.categoryId,
    )?.categoryId as string;
    expect(
      await removeMasterRecord(store, 'category', categoryId, 'owner'),
    ).toMatchObject({
      ok: false,
      error: { code: 'category_in_use' },
    });
  });

  it('adds a unit with its symbol', async () => {
    const added = await addUnit(
      store,
      { nameTh: 'กล่อง', nameEn: 'box', symbol: 'box' },
      'owner',
    );
    expect(added.ok).toBe(true);
  });
});

describe('importRows', () => {
  const row = (overrides: Partial<ImportRow> = {}): ImportRow => ({
    line: 2,
    nameTh: 'นำเข้า',
    nameEn: null,
    sku: null,
    barcode: null,
    category: 'เครื่องดื่ม',
    unit: 'ขวด',
    quantity: 4,
    costBaht: 12,
    priceBaht: null,
    minQty: 1,
    reorderQty: 3,
    supplier: 'ร้านส่ง',
    location: null,
    date: '2026-10-20',
    ...overrides,
  });

  it('creates items, the missing master data, and dated opening stock', async () => {
    const result = await importRows(
      store,
      [row(), row({ nameTh: 'สอง', sku: 'IMP-1' })],
      'owner',
      {
        now: () => TEST_NOW,
      },
    );
    expect(result).toMatchObject({ ok: true, data: { imported: 2 } });
    const created = Object.values(ledger().entities.item).find(
      (entry) => entry.nameTh === 'นำเข้า',
    )!;
    expect(ledger().balances[created.id]).toBe(4);
    const opening = ledger().movements.at(-1)!;
    expect(opening.reason).toBe('opening');
    expect(opening.occurredAt).toBe('2026-10-20T09:00:00+07:00');
    expect(result.ok && result.data.units).toEqual([]);
  });

  it('refuses a SKU the shop already has', async () => {
    const other = existingItem();
    const result = await importRows(store, [row({ sku: other.sku })], 'owner');
    expect(result).toMatchObject({ ok: false, error: { code: 'sku_taken' } });
  });

  it('is owner only', async () => {
    expect(await importRows(store, [row()], 'staff')).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
  });
});

describe('change history', () => {
  it('lists an edit with the fields that changed', async () => {
    const target = existingItem();
    await saveItem(
      store,
      itemInput({ id: target.id, nameTh: 'ชื่อใหม่', sku: target.sku }),
      'owner',
    );
    const ops = store.getState().ops;
    const template = snapshot().items.find(
      (row) => String(row.id) === target.id,
    )!;
    const changes = changeViews(ops, ledger().users, target.id, {
      ...template,
      packs: [],
    });
    expect(changes[0]?.action).toBe('update');
    expect(changes[0]?.diff.nameTh?.after).toBe('ชื่อใหม่');
  });

  it('a search still finds a renamed item', async () => {
    const target = existingItem();
    await saveItem(
      store,
      itemInput({ id: target.id, nameTh: 'ชื่อพิเศษ', sku: target.sku }),
      'owner',
    );
    const views = itemViews(ledger(), 'owner');
    expect(
      searchViews(views, 'ชื่อพิเศษ').some((view) => view.id === target.id),
    ).toBe(true);
  });
});
