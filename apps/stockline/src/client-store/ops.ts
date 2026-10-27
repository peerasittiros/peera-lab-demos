import {
  movingAverageCost,
  signedQuantity,
  type MovementType,
  type Role,
} from '../domain/stock';
import { sampleImage } from '../lib/sample-images';
import type { Snapshot } from './snapshot';

// Every change a visitor makes is an op. An op is appended to the log and never edited; the state is the snapshot
// with every op applied in order (`replay`). Reducers are pure: no clock, no randomness, no storage.

export type EntityKind =
  'item' | 'supplier' | 'category' | 'unit' | 'order' | 'count';
const ENTITY_KINDS: readonly EntityKind[] = [
  'item',
  'supplier',
  'category',
  'unit',
  'order',
  'count',
];

/** One master-data row, as plain JSON (camelCase, the snapshot's field names). Items carry their `packs`. */
export type EntityRow = { id: string } & Record<string, unknown>;

export type Settings = {
  shopNameTh: string;
  shopNameEn: string | null;
  lowStockRule: 'at_or_below_min' | 'below_min';
  reorderWeekday: number;
};

type OpBase = { id: string; at: string; role: Role };

export type RecordMovementOp = OpBase & {
  kind: 'movement.record';
  payload: {
    itemId: string;
    type: MovementType;
    reason: string;
    enteredQty: number | null;
    enteredUnitId: string | null;
    /** Entered quantity converted to base units, unsigned for in and out (`signedQuantity` gives the sign). */
    quantityBase: number;
    /** Satang per base unit, owner's receipts only. */
    unitCostSatang: number | null;
    reference: string | null;
    note: string | null;
    userId: string | null;
    /** The stock count this adjustment belongs to, if any. */
    countSessionId?: string | null;
  };
};

/** Creates or replaces one master-data row (the whole row, so replay needs no merge rules). */
export type EntitySaveOp = OpBase & {
  kind: 'entity.save';
  payload: {
    entity: EntityKind;
    entityId: string;
    row: Record<string, unknown>;
  };
};

export type EntityRemoveOp = OpBase & {
  kind: 'entity.remove';
  payload: { entity: EntityKind; entityId: string };
};

export type SettingsSaveOp = OpBase & {
  kind: 'settings.save';
  payload: Settings;
};

export type Op =
  RecordMovementOp | EntitySaveOp | EntityRemoveOp | SettingsSaveOp;

export type MovementRecord = {
  id: string;
  itemId: string;
  type: MovementType;
  reason: string;
  /** Signed, in base units (the ledger's sign rule). */
  quantityBase: number;
  enteredQty: number | null;
  enteredUnitId: string | null;
  unitCostSatang: number | null;
  reference: string | null;
  note: string | null;
  userId: string | null;
  countSessionId: string | null;
  occurredAt: string;
  /** Computed by the reducer, never stored in the snapshot. */
  balanceAfter: number;
  /** True for movements the visitor recorded; false for the template's history. */
  visitor: boolean;
};

export type Entities = Record<EntityKind, Record<string, EntityRow>>;

export type Ledger = {
  movements: MovementRecord[];
  /** On hand per item id, in base units. Every item has a key, even with no balance row. */
  balances: Record<string, number>;
  /** Master data: items (with packs), suppliers, categories and units, by id. */
  entities: Entities;
  settings: Settings;
  /** The shop's sample people, by role, for names on movements and changes. */
  users: Record<Role, { id: string; displayName: string }>;
  /** Op ids already applied: the same op twice is a no-op. */
  applied: Record<string, true>;
};

export type ApplyOutcome = 'applied' | 'duplicate' | 'skipped';

const nullable = <T>(value: unknown, convert: (value: unknown) => T) =>
  value == null ? null : convert(value);

const byId = (rows: Record<string, unknown>[]) =>
  Object.fromEntries(
    rows.map((row) => [
      String(row.id),
      { ...row, id: String(row.id) } as EntityRow,
    ]),
  );

/** The template's history and master data as a ledger with no visitor ops yet. */
export function ledgerFromSnapshot(snapshot: Snapshot): Ledger {
  const balances: Record<string, number> = {};
  for (const item of snapshot.items) balances[String(item.id)] = 0;
  for (const row of snapshot.balances)
    balances[String(row.itemId)] = Number(row.onHand);

  const packs = new Map<string, { unitId: string; factor: number }[]>();
  for (const row of snapshot.itemUnits) {
    const list = packs.get(String(row.itemId)) ?? [];
    list.push({ unitId: String(row.unitId), factor: Number(row.factor) });
    packs.set(String(row.itemId), list);
  }
  // Sample items without a stored image get their bundled photo (lib/sample-images.ts), so the template in the
  // database needs no reseed for it.
  const items = snapshot.items.map((row) => ({
    ...row,
    imageUrl: row.imageUrl ?? sampleImage(snapshot.variant, nullable(row.sku, String)),
    packs: packs.get(String(row.id)) ?? [],
  }));

  const movements = snapshot.movements.map((row): MovementRecord => ({
    id: String(row.id),
    itemId: String(row.itemId),
    type: row.type as MovementType,
    reason: String(row.reason),
    quantityBase: Number(row.quantityBase),
    enteredQty: nullable(row.enteredQty, Number),
    enteredUnitId: nullable(row.enteredUnitId, String),
    unitCostSatang: nullable(row.unitCostSatang, Number),
    reference: nullable(row.reference, String),
    note: nullable(row.note, String),
    userId: nullable(row.userId, String),
    countSessionId: nullable(row.countSessionId, String),
    occurredAt: String(row.occurredAt),
    balanceAfter: Number(row.balanceAfter),
    visitor: false,
  }));

  const orderLines = new Map<string, Record<string, unknown>[]>();
  for (const line of snapshot.orderLines) {
    const list = orderLines.get(String(line.purchaseOrderId)) ?? [];
    list.push({
      id: String(line.id),
      itemId: String(line.itemId),
      qtyBase: Number(line.qtyBase),
      receivedBase: Number(line.receivedBase),
    });
    orderLines.set(String(line.purchaseOrderId), list);
  }
  const orders = snapshot.orders.map((row) => ({
    ...row,
    lines: orderLines.get(String(row.id)) ?? [],
  }));

  const countLines = new Map<string, Record<string, unknown>[]>();
  for (const line of snapshot.countLines) {
    const list = countLines.get(String(line.countSessionId)) ?? [];
    list.push({
      id: String(line.id),
      itemId: String(line.itemId),
      expected: Number(line.expected),
      counted: nullable(line.counted, Number),
      countedAt: nullable(line.countedAt, String),
    });
    countLines.set(String(line.countSessionId), list);
  }
  const counts = snapshot.countSessions.map((row) => ({
    ...row,
    lines: countLines.get(String(row.id)) ?? [],
  }));

  const shop = snapshot.shopSettings;
  return {
    movements,
    balances,
    entities: {
      item: byId(items),
      supplier: byId(snapshot.suppliers),
      category: byId(snapshot.categories),
      unit: byId(snapshot.units),
      order: byId(orders),
      count: byId(counts),
    },
    users: Object.fromEntries(
      snapshot.users.map((user) => [
        user.role,
        { id: String(user.id), displayName: String(user.displayName) },
      ]),
    ) as Ledger['users'],
    settings: {
      shopNameTh: String(shop.shopNameTh),
      shopNameEn: nullable(shop.shopNameEn, String),
      lowStockRule: shop.lowStockRule as Settings['lowStockRule'],
      reorderWeekday: Number(shop.reorderWeekday),
    },
    applied: {},
  };
}

function validRecordMovement(op: RecordMovementOp): boolean {
  const { quantityBase, type } = op.payload;
  if (!Number.isInteger(quantityBase) || quantityBase === 0) return false;
  return type === 'in' || type === 'out' || type === 'adjust';
}

function validEntity(op: EntitySaveOp | EntityRemoveOp): boolean {
  return (
    ENTITY_KINDS.includes(op.payload.entity) &&
    typeof op.payload.entityId === 'string'
  );
}

function applyMovement(
  ledger: Ledger,
  op: RecordMovementOp,
): { ledger: Ledger; outcome: ApplyOutcome } {
  if (!validRecordMovement(op)) return { ledger, outcome: 'skipped' };
  const { itemId, type, quantityBase, unitCostSatang } = op.payload;
  if (!(itemId in ledger.balances)) return { ledger, outcome: 'skipped' };

  const onHand = ledger.balances[itemId] ?? 0;
  const delta = signedQuantity(type, quantityBase);
  const balanceAfter = onHand + delta;
  const costed = type === 'in' && unitCostSatang !== null;
  const item = ledger.entities.item[itemId];

  const movement: MovementRecord = {
    id: op.id,
    itemId,
    type,
    reason: op.payload.reason,
    quantityBase: delta,
    enteredQty: op.payload.enteredQty,
    enteredUnitId: op.payload.enteredUnitId,
    unitCostSatang: costed ? unitCostSatang : null,
    reference: op.payload.reference,
    note: op.payload.note,
    userId: op.payload.userId,
    countSessionId: op.payload.countSessionId ?? null,
    occurredAt: op.at,
    balanceAfter,
    visitor: true,
  };

  return {
    ledger: {
      ...ledger,
      movements: [...ledger.movements, movement],
      balances: { ...ledger.balances, [itemId]: balanceAfter },
      entities:
        costed && item
          ? {
              ...ledger.entities,
              item: {
                ...ledger.entities.item,
                [itemId]: {
                  ...item,
                  costSatang: movingAverageCost(
                    onHand,
                    nullable(item.costSatang, Number),
                    quantityBase,
                    unitCostSatang,
                  ),
                },
              },
            }
          : ledger.entities,
      applied: { ...ledger.applied, [op.id]: true },
    },
    outcome: 'applied',
  };
}

/**
 * Applies one op. A repeated op is a `duplicate` and changes nothing. An op that cannot apply (a movement for an
 * item the shop does not have after a new-day refresh, a malformed payload) is `skipped`, so the caller can count it.
 */
export function applyOp(
  ledger: Ledger,
  op: Op,
): { ledger: Ledger; outcome: ApplyOutcome } {
  if (ledger.applied[op.id]) return { ledger, outcome: 'duplicate' };

  switch (op.kind) {
    case 'movement.record':
      return applyMovement(ledger, op);
    case 'entity.save': {
      if (!validEntity(op)) return { ledger, outcome: 'skipped' };
      const { entity, entityId, row } = op.payload;
      const next = { ...row, id: entityId } as EntityRow;
      return {
        ledger: {
          ...ledger,
          // A new item starts with no stock; an existing one keeps its balance.
          balances:
            entity === 'item' && !(entityId in ledger.balances)
              ? { ...ledger.balances, [entityId]: 0 }
              : ledger.balances,
          entities: {
            ...ledger.entities,
            [entity]: { ...ledger.entities[entity], [entityId]: next },
          },
          applied: { ...ledger.applied, [op.id]: true },
        },
        outcome: 'applied',
      };
    }
    case 'entity.remove': {
      if (!validEntity(op)) return { ledger, outcome: 'skipped' };
      const { entity, entityId } = op.payload;
      const rest = { ...ledger.entities[entity] };
      delete rest[entityId];
      return {
        ledger: {
          ...ledger,
          entities: { ...ledger.entities, [entity]: rest },
          applied: { ...ledger.applied, [op.id]: true },
        },
        outcome: 'applied',
      };
    }
    case 'settings.save':
      return {
        ledger: {
          ...ledger,
          settings: op.payload,
          applied: { ...ledger.applied, [op.id]: true },
        },
        outcome: 'applied',
      };
    default:
      return { ledger, outcome: 'skipped' };
  }
}

/** Rebuilds the state from the snapshot and the whole op log, in order. */
export function replay(
  snapshot: Snapshot,
  ops: Op[],
): { ledger: Ledger; skipped: number } {
  let ledger = ledgerFromSnapshot(snapshot);
  let skipped = 0;
  for (const op of ops) {
    const result = applyOp(ledger, op);
    ledger = result.ledger;
    if (result.outcome === 'skipped') skipped += 1;
  }
  return { ledger, skipped };
}
