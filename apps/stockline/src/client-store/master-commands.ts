import { formatPhone } from '@peera/i18n';
import type { z } from 'zod';
import { MAX_IMPORT_ROWS, type ImportRow } from '../domain/import';
import { ROW_CAPS } from '../domain/limits';
import type { ItemFields } from '../domain/master-input';
import type * as Schemas from './schemas';
import { newId } from './ids';
import type { CommandResult } from './commands';
import type { EntityKind, Op, Settings } from './ops';
import type { Store } from './store';
import type { Role } from '../domain/stock';

// Commands for master data: items, suppliers, categories, units and the shop settings. Owner only, as on the server.
// Each one checks its input with the shared schema, checks the references and the row caps, then dispatches the
// op (or ops) that change the browser store.

export const fail = (code: string, messageKey: string) => ({
  ok: false as const,
  error: { code, messageKey },
});

export const ownerOnly = (role: Role) =>
  role === 'owner' ? null : fail('forbidden', 'errors.forbidden');

export function userIdOf(store: Store, role: Role): string | null {
  const user = store
    .getState()
    .snapshot?.users.find((row) => row.role === role);
  return user ? String(user.id) : null;
}

/** The store's rows of one kind, as a list. */
export function rowsOf(store: Store, kind: EntityKind) {
  return Object.values(store.getState().ledger?.entities[kind] ?? {});
}

/** `STK-0001`, one past the highest SKU of this shop. */
function nextSku(store: Store): string {
  const highest = rowsOf(store, 'item').reduce((max, row) => {
    const match = /^STK-(\d+)$/.exec(String(row.sku));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `STK-${String(highest + 1).padStart(4, '0')}`;
}

export async function dispatchAll(store: Store, ops: Op[]): Promise<boolean> {
  for (const op of ops) {
    try {
      const outcome = await store.dispatch(op);
      if (outcome === 'skipped') return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Zod and the schemas, loaded on the first command (see `schemas.ts`). */
export const loadSchemas = () => import('./schemas');

export type ItemInput = z.input<typeof Schemas.itemInput>;

/** Creates an item (with its opening stock) or updates one. Pack units replace the old ones. */
export async function saveItem(
  store: Store,
  input: ItemInput,
  role: Role,
  options: { now?: () => Date } = {},
): Promise<CommandResult<{ id: string }>> {
  const denied = ownerOnly(role);
  if (denied) return denied;
  const parsed = (await loadSchemas()).itemInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input', 'errors.invalidInput');
  const { id, openingQty, ...fields } = parsed.data;
  const ledger = store.getState().ledger;
  if (!ledger) return fail('not_ready', 'errors.unexpected');

  const existing = id ? ledger.entities.item[id] : undefined;
  if (id && !existing) return fail('not_found', 'errors.notFound');
  if (!existing && rowsOf(store, 'item').length >= ROW_CAPS.items)
    return fail('row_cap', 'errors.rowCap');

  const units = ledger.entities.unit;
  const unitIds = [
    fields.baseUnitId,
    ...fields.packs.map((pack) => pack.unitId),
  ];
  if (unitIds.some((unitId) => !(unitId in units)))
    return fail('invalid_input', 'errors.invalidInput');
  if (fields.categoryId && !(fields.categoryId in ledger.entities.category))
    return fail('invalid_input', 'errors.invalidInput');
  if (fields.supplierId && !(fields.supplierId in ledger.entities.supplier))
    return fail('invalid_input', 'errors.invalidInput');

  const others = rowsOf(store, 'item').filter((row) => row.id !== id);
  if (
    fields.sku &&
    others.some(
      (row) => String(row.sku).toLowerCase() === fields.sku!.toLowerCase(),
    )
  )
    return fail('sku_taken', 'errors.skuTaken');
  if (fields.barcode && others.some((row) => row.barcode === fields.barcode))
    return fail('barcode_taken', 'errors.barcodeTaken');

  const itemId = id ?? newId();
  const row = toItemRow(fields, {
    sku: fields.sku ?? (existing ? String(existing.sku) : nextSku(store)),
    active: existing ? existing.active !== false : true,
    imageUrl: existing?.imageUrl == null ? null : String(existing.imageUrl),
  });
  const ops: Op[] = [entitySave(store, options, role, 'item', itemId, row)];
  if (!existing && openingQty > 0) {
    ops.push(
      movementOp(store, options, role, {
        itemId,
        type: 'in',
        reason: 'opening',
        quantityBase: openingQty,
        enteredQty: openingQty,
        enteredUnitId: fields.baseUnitId,
        unitCostSatang: row.costSatang as number | null,
      }),
    );
  }
  return (await dispatchAll(store, ops))
    ? { ok: true, data: { id: itemId } }
    : fail('write_failed', 'errors.unexpected');
}

function toItemRow(
  fields: ItemFields,
  rest: { sku: string; active: boolean; imageUrl: string | null },
) {
  return {
    nameTh: fields.nameTh,
    nameEn: fields.nameEn,
    sku: rest.sku,
    barcode: fields.barcode,
    categoryId: fields.categoryId,
    baseUnitId: fields.baseUnitId,
    packs: fields.packs,
    costSatang:
      fields.costBaht === null ? null : Math.round(fields.costBaht * 100),
    priceSatang:
      fields.priceBaht === null ? null : Math.round(fields.priceBaht * 100),
    minQty: fields.minQty,
    reorderQty: fields.reorderQty,
    supplierId: fields.supplierId,
    location: fields.location,
    imageUrl: rest.imageUrl,
    active: rest.active,
  };
}

/** Archives an item (hidden from quick move and reorder; its history stays) or restores it. */
export async function setItemActive(
  store: Store,
  id: string,
  active: boolean,
  role: Role,
) {
  const denied = ownerOnly(role);
  if (denied) return denied;
  const existing = store.getState().ledger?.entities.item[id];
  if (!existing) return fail('not_found', 'errors.notFound');
  if ((existing.active !== false) === active)
    return { ok: true as const, data: { id } };
  const row = { ...existing, active };
  return (await dispatchAll(store, [
    entitySave(store, {}, role, 'item', id, row),
  ]))
    ? { ok: true as const, data: { id } }
    : fail('write_failed', 'errors.unexpected');
}


export async function saveSupplier(
  store: Store,
  input: z.input<typeof Schemas.supplierInput>,
  role: Role,
) {
  const denied = ownerOnly(role);
  if (denied) return denied;
  const parsed = (await loadSchemas()).supplierInput.safeParse(input);
  if (!parsed.success) return fail('invalid_input', 'errors.invalidInput');
  const { id, phone, ...fields } = parsed.data;
  if (id && !store.getState().ledger?.entities.supplier[id])
    return fail('not_found', 'errors.notFound');
  if (!id && rowsOf(store, 'supplier').length >= ROW_CAPS.suppliers)
    return fail('row_cap', 'errors.rowCap');
  let stored: string | null = null;
  if (phone) {
    try {
      stored = formatPhone(phone, 'storage');
    } catch {
      return fail('phone_invalid', 'suppliers.form.phoneInvalid');
    }
  }
  const supplierId = id ?? newId();
  return (await dispatchAll(store, [
    entitySave(store, {}, role, 'supplier', supplierId, {
      ...fields,
      phone: stored,
    }),
  ]))
    ? { ok: true as const, data: { id: supplierId } }
    : fail('write_failed', 'errors.unexpected');
}

export async function saveSettings(
  store: Store,
  input: z.input<typeof Schemas.settingsFields>,
  role: Role,
) {
  const denied = ownerOnly(role);
  if (denied) return denied;
  const parsed = (await loadSchemas()).settingsFields.safeParse(input);
  if (!parsed.success) return fail('invalid_input', 'errors.invalidInput');
  const payload: Settings = parsed.data;
  return (await dispatchAll(store, [settingsOp(store, role, payload)]))
    ? { ok: true as const, data: { saved: true } }
    : fail('write_failed', 'errors.unexpected');
}

export async function addCategory(
  store: Store,
  input: z.input<typeof Schemas.namedFields>,
  role: Role,
) {
  const denied = ownerOnly(role);
  if (denied) return denied;
  const parsed = (await loadSchemas()).namedFields.safeParse(input);
  if (!parsed.success) return fail('invalid_input', 'errors.invalidInput');
  if (rowsOf(store, 'category').length >= ROW_CAPS.categories)
    return fail('row_cap', 'errors.rowCap');
  const id = newId();
  const sort = rowsOf(store, 'category').length;
  return (await dispatchAll(store, [
    entitySave(store, {}, role, 'category', id, { ...parsed.data, sort }),
  ]))
    ? { ok: true as const, data: { id } }
    : fail('write_failed', 'errors.unexpected');
}

export async function addUnit(
  store: Store,
  input: z.input<typeof Schemas.unitFields>,
  role: Role,
) {
  const denied = ownerOnly(role);
  if (denied) return denied;
  const parsed = (await loadSchemas()).unitFields.safeParse(input);
  if (!parsed.success) return fail('invalid_input', 'errors.invalidInput');
  if (rowsOf(store, 'unit').length >= ROW_CAPS.units)
    return fail('row_cap', 'errors.rowCap');
  const id = newId();
  return (await dispatchAll(store, [
    entitySave(store, {}, role, 'unit', id, parsed.data),
  ]))
    ? { ok: true as const, data: { id } }
    : fail('write_failed', 'errors.unexpected');
}

/** Removes a category or unit nobody uses. Items keep their history; a used one must be emptied first. */
export async function removeMasterRecord(
  store: Store,
  kind: 'category' | 'unit',
  id: string,
  role: Role,
) {
  const denied = ownerOnly(role);
  if (denied) return denied;
  const ledger = store.getState().ledger;
  if (!ledger?.entities[kind][id]) return fail('not_found', 'errors.notFound');
  const items = Object.values(ledger.entities.item);
  if (kind === 'category') {
    if (items.some((row) => row.categoryId === id))
      return fail('category_in_use', 'errors.categoryInUse');
  } else {
    const used =
      items.some(
        (row) =>
          row.baseUnitId === id ||
          (row.packs as { unitId: string }[]).some(
            (pack) => pack.unitId === id,
          ),
      ) || ledger.movements.some((movement) => movement.enteredUnitId === id);
    if (used) return fail('unit_in_use', 'errors.unitInUse');
  }
  return (await dispatchAll(store, [
    {
      id: newId(),
      kind: 'entity.remove',
      at: nowOf(store, {}),
      role,
      payload: { entity: kind, entityId: id },
    },
  ]))
    ? { ok: true as const, data: { id } }
    : fail('write_failed', 'errors.unexpected');
}

// Helpers that build ops with the same ids and times every command uses.

export function nowOf(_store: Store, options: { now?: () => Date }) {
  return (options.now ?? (() => new Date()))().toISOString();
}

export function entitySave(
  store: Store,
  options: { now?: () => Date },
  role: Role,
  entity: EntityKind,
  entityId: string,
  row: Record<string, unknown>,
): Op {
  return {
    id: newId(),
    kind: 'entity.save',
    at: nowOf(store, options),
    role,
    payload: { entity, entityId, row },
  };
}

function settingsOp(store: Store, role: Role, payload: Settings): Op {
  return {
    id: newId(),
    kind: 'settings.save',
    at: nowOf(store, {}),
    role,
    payload,
  };
}

function movementOp(
  store: Store,
  options: { now?: () => Date; at?: string },
  role: Role,
  payload: {
    itemId: string;
    type: 'in' | 'out' | 'adjust';
    reason: string;
    quantityBase: number;
    enteredQty: number | null;
    enteredUnitId: string | null;
    unitCostSatang: number | null;
    reference?: string | null;
    countSessionId?: string | null;
  },
): Op {
  const { reference, ...rest } = payload;
  return {
    id: newId(),
    kind: 'movement.record',
    at: options.at ?? nowOf(store, options),
    role,
    payload: {
      ...rest,
      reference: reference ?? null,
      note: null,
      userId: userIdOf(store, role),
    },
  };
}

/**
 * Creates items (with their opening stock) from validated import rows. Categories, units and suppliers are matched by
 * name and created when missing. SKUs and barcodes are checked again here, as the server import does (02 §3.1 item 9).
 */
export async function importRows(
  store: Store,
  rows: ImportRow[],
  role: Role,
  options: { now?: () => Date } = {},
): Promise<
  CommandResult<{ imported: number; categories: string[]; units: string[] }>
> {
  const denied = ownerOnly(role);
  if (denied) return denied;
  const ledger = store.getState().ledger;
  if (!ledger) return fail('not_ready', 'errors.unexpected');
  if (rows.length === 0 || rows.length > MAX_IMPORT_ROWS)
    return fail('invalid_input', 'errors.invalidInput');
  if (
    rowsOf(store, 'item').length + rows.length > ROW_CAPS.items ||
    ledger.movements.length + rows.length > ROW_CAPS.movements
  )
    return fail('row_cap', 'errors.rowCap');

  const items = rowsOf(store, 'item');
  const skus = new Set(items.map((row) => String(row.sku).toLowerCase()));
  const barcodes = new Set(
    items.flatMap((row) => (row.barcode ? [String(row.barcode)] : [])),
  );
  for (const row of rows) {
    if (row.sku && skus.has(row.sku.toLowerCase()))
      return fail('sku_taken', 'errors.skuTaken');
    if (row.barcode && barcodes.has(row.barcode))
      return fail('barcode_taken', 'errors.barcodeTaken');
  }

  const key = (value: string) => value.trim().toLowerCase();
  const categories = new Map<string, string>();
  for (const row of rowsOf(store, 'category')) {
    categories.set(key(String(row.nameTh)), row.id);
    if (row.nameEn) categories.set(key(String(row.nameEn)), row.id);
  }
  const units = new Map<string, string>();
  for (const row of rowsOf(store, 'unit'))
    for (const name of [row.nameTh, row.nameEn, row.symbol])
      if (name) units.set(key(String(name)), row.id);
  const suppliers = new Map<string, string>();
  for (const row of rowsOf(store, 'supplier'))
    suppliers.set(key(String(row.name)), row.id);

  const ops: Op[] = [];
  const created = { categories: [] as string[], units: [] as string[] };
  let categoryCount = rowsOf(store, 'category').length;

  const categoryId = (name: string | null): string | null => {
    if (!name) return null;
    const found = categories.get(key(name));
    if (found) return found;
    const id = newId();
    ops.push(
      entitySave(store, options, role, 'category', id, {
        nameTh: name,
        nameEn: null,
        sort: categoryCount++,
      }),
    );
    categories.set(key(name), id);
    created.categories.push(name);
    return id;
  };
  const unitId = (name: string | null): string => {
    const label = name?.trim() || 'ชิ้น';
    const found = units.get(key(label));
    if (found) return found;
    const id = newId();
    ops.push(
      entitySave(store, options, role, 'unit', id, {
        nameTh: label,
        nameEn: null,
        symbol: label.slice(0, 8),
      }),
    );
    units.set(key(label), id);
    created.units.push(label);
    return id;
  };
  const supplierId = (name: string | null): string | null => {
    if (!name) return null;
    const found = suppliers.get(key(name));
    if (found) return found;
    const id = newId();
    ops.push(
      entitySave(store, options, role, 'supplier', id, {
        name,
        contactName: null,
        phone: null,
        lineId: null,
        leadTimeDays: 0,
        note: null,
      }),
    );
    suppliers.set(key(name), id);
    return id;
  };

  let highest = items.reduce((max, row) => {
    const match = /^STK-(\d+)$/.exec(String(row.sku));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  for (const row of rows) {
    const itemId = newId();
    const baseUnitId = unitId(row.unit);
    const costSatang =
      row.costBaht === null ? null : Math.round(row.costBaht * 100);
    const sku = row.sku ?? `STK-${String(++highest).padStart(4, '0')}`;
    ops.push(
      entitySave(store, options, role, 'item', itemId, {
        nameTh: row.nameTh,
        nameEn: row.nameEn,
        sku,
        barcode: row.barcode,
        categoryId: categoryId(row.category),
        baseUnitId,
        packs: [],
        costSatang,
        priceSatang:
          row.priceBaht === null ? null : Math.round(row.priceBaht * 100),
        minQty: row.minQty,
        reorderQty: row.reorderQty,
        supplierId: supplierId(row.supplier),
        location: row.location,
        imageUrl: null,
        active: true,
      }),
    );
    if (row.quantity > 0)
      ops.push(
        movementOp(
          store,
          {
            now: options.now,
            at: row.date ? `${row.date}T09:00:00+07:00` : undefined,
          },
          role,
          {
            itemId,
            type: 'in',
            reason: 'opening',
            quantityBase: row.quantity,
            enteredQty: row.quantity,
            enteredUnitId: baseUnitId,
            unitCostSatang: costSatang,
          },
        ),
      );
  }

  return (await dispatchAll(store, ops))
    ? { ok: true, data: { imported: rows.length, ...created } }
    : fail('write_failed', 'errors.unexpected');
}

export { movementOp };
