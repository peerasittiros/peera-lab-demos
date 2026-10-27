import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryPersistence } from './idb';
import {
  addCategory,
  addUnit,
  importRows,
  moveRecord,
  removeMasterRecord,
  saveCategory,
  saveItem,
  saveSettings,
  saveSupplier,
  saveUnit,
  saveUser,
  setItemActive,
} from './master-commands';
import { createStore, type Store } from './store';
import { seedSnapshot, TEST_NOW } from './testing';
import {
  categoryViews,
  changeViews,
  filterItems,
  itemViews,
  searchViews,
  unitViews,
} from './views';
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
      { nameTh: 'ถาด', nameEn: 'tray', symbol: 'tray' },
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

describe('settings pages: categories, units, suppliers, people, shop', () => {
  const tinyWebp =
    'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  const ids = (kind: 'category' | 'unit') =>
    (kind === 'category' ? categoryViews(ledger()) : unitViews(ledger())).map(
      (entry) => entry.id,
    );

  it('renames a category and keeps its place', async () => {
    const [first, second] = categoryViews(ledger());
    const result = await saveCategory(
      store,
      { id: second!.id, nameTh: 'ชื่อใหม่', nameEn: 'Renamed' },
      'owner',
    );
    expect(result.ok).toBe(true);
    const after = categoryViews(ledger());
    expect(after[0]!.id).toBe(first!.id);
    expect(after[1]).toMatchObject({
      id: second!.id,
      nameTh: 'ชื่อใหม่',
      nameEn: 'Renamed',
    });
  });

  it('adds a new category last', async () => {
    const result = await saveCategory(
      store,
      { nameTh: 'หมวดใหม่', nameEn: '' },
      'owner',
    );
    expect(result.ok).toBe(true);
    expect(categoryViews(ledger()).at(-1)?.nameTh).toBe('หมวดใหม่');
  });

  it('edits a unit, and refuses a short form another unit uses', async () => {
    const [first, second] = unitViews(ledger());
    const clash = await saveUnit(
      store,
      {
        id: first!.id,
        nameTh: first!.nameTh,
        nameEn: first!.nameEn ?? '',
        symbol: second!.symbol.toUpperCase(),
      },
      'owner',
    );
    expect(clash).toMatchObject({ ok: false, error: { code: 'symbol_taken' } });
    const edited = await saveUnit(
      store,
      {
        id: first!.id,
        nameTh: 'ขวดแก้ว',
        nameEn: 'Glass bottle',
        symbol: 'gb',
      },
      'owner',
    );
    expect(edited.ok).toBe(true);
    expect(
      unitViews(ledger()).find((entry) => entry.id === first!.id),
    ).toMatchObject({ nameTh: 'ขวดแก้ว', symbol: 'gb' });
  });

  it('moves a category up and down, and stays put at either end', async () => {
    const before = ids('category');
    const down = await moveRecord(
      store,
      'category',
      before[0]!,
      'down',
      'owner',
    );
    expect(down).toMatchObject({ ok: true, data: { position: 1 } });
    expect(ids('category').slice(0, 2)).toEqual([before[1], before[0]]);
    const up = await moveRecord(store, 'category', before[0]!, 'up', 'owner');
    expect(up).toMatchObject({ ok: true, data: { position: 0 } });
    expect(ids('category')).toEqual(before);
    const top = await moveRecord(store, 'category', before[0]!, 'up', 'owner');
    expect(top).toMatchObject({ ok: true, data: { position: 0 } });
    expect(ids('category')).toEqual(before);
  });

  it('gives units a stable order the first time one moves (the sample units share sort 0)', async () => {
    const before = ids('unit');
    await moveRecord(store, 'unit', before[2]!, 'up', 'owner');
    expect(ids('unit')).toEqual([
      before[0],
      before[2],
      before[1],
      ...before.slice(3),
    ]);
    const sorts = unitViews(ledger()).map((entry) => entry.sort);
    expect(sorts).toEqual(sorts.map((_, index) => index));
  });

  it('removes an unused supplier, and refuses one an item uses', async () => {
    const used = String(
      Object.values(ledger().entities.item).find((row) => row.supplierId)!
        .supplierId,
    );
    expect(
      await removeMasterRecord(store, 'supplier', used, 'owner'),
    ).toMatchObject({ ok: false, error: { code: 'supplier_in_use' } });
    const added = await saveSupplier(
      store,
      { name: 'ร้านใหม่', leadTimeDays: 1 },
      'owner',
    );
    if (!added.ok) throw new Error('supplier not added');
    const removed = await removeMasterRecord(
      store,
      'supplier',
      added.data.id,
      'owner',
    );
    expect(removed.ok).toBe(true);
    expect(ledger().entities.supplier[added.data.id]).toBeUndefined();
  });

  it('renames a person, owner only', async () => {
    const asStaff = await saveUser(
      store,
      { role: 'staff', displayName: 'น้องเมย์' },
      'staff',
    );
    expect(asStaff.ok).toBe(false);
    const asOwner = await saveUser(
      store,
      { role: 'staff', displayName: 'น้องเมย์' },
      'owner',
    );
    expect(asOwner.ok).toBe(true);
    expect(ledger().users.staff.displayName).toBe('น้องเมย์');
  });

  it('saves the shop page without touching the stock rules, and the other way round', async () => {
    await saveSettings(
      store,
      { lowStockRule: 'below_min', reorderWeekday: 3 },
      'owner',
    );
    const shop = await saveSettings(
      store,
      {
        shopNameTh: 'ร้านทดสอบ',
        phone: '081-234-5678',
        address: 'ซอย 1',
        logoUrl: tinyWebp,
      },
      'owner',
    );
    expect(shop.ok).toBe(true);
    expect(ledger().settings).toMatchObject({
      shopNameTh: 'ร้านทดสอบ',
      phone: '+66812345678',
      address: 'ซอย 1',
      logoUrl: tinyWebp,
      lowStockRule: 'below_min',
      reorderWeekday: 3,
    });
    await saveSettings(store, { lowStockRule: 'at_or_below_min' }, 'owner');
    expect(ledger().settings.logoUrl).toBe(tinyWebp);
    await saveSettings(store, { logoUrl: null }, 'owner');
    expect(ledger().settings.logoUrl).toBeNull();
  });

  it('refuses a logo that is not a small WebP or JPEG data URL, and a bad phone', async () => {
    for (const logoUrl of [
      'https://example.com/logo.png',
      'data:image/png;base64,AAAA',
      `data:image/webp;base64,${'A'.repeat(170_000)}`,
    ]) {
      const result = await saveSettings(store, { logoUrl }, 'owner');
      expect(result.ok).toBe(false);
    }
    expect(await saveSettings(store, { phone: '12' }, 'owner')).toMatchObject({
      ok: false,
      error: { code: 'phone_invalid' },
    });
  });

  it('stores an item photo, keeps it on later edits and removes it on null', async () => {
    const created = await saveItem(
      store,
      itemInput({ imageUrl: tinyWebp }),
      'owner',
    );
    if (!created.ok) throw new Error('not created');
    const id = created.data.id;
    expect(ledger().entities.item[id]!.imageUrl).toBe(tinyWebp);
    await saveItem(store, { ...itemInput({ nameTh: 'แก้ชื่อ' }), id }, 'owner');
    expect(ledger().entities.item[id]!.imageUrl).toBe(tinyWebp);
    await saveItem(store, { ...itemInput({ imageUrl: null }), id }, 'owner');
    expect(ledger().entities.item[id]!.imageUrl).toBeNull();
  });

  it('keeps every settings command owner only', async () => {
    const [category] = categoryViews(ledger());
    const results = [
      await saveCategory(store, { nameTh: 'x', nameEn: '' }, 'staff'),
      await saveUnit(store, { nameTh: 'x', nameEn: '', symbol: 'zz' }, 'staff'),
      await moveRecord(store, 'category', category!.id, 'down', 'staff'),
      await saveSettings(store, { shopNameTh: 'x' }, 'staff'),
    ];
    for (const result of results)
      expect(result).toMatchObject({ ok: false, error: { code: 'forbidden' } });
  });
});
