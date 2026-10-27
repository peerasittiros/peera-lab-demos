import type { ItemView, Unit } from '../domain/read-models';
import { itemStatus, type LowStockRule, type Role } from '../domain/stock';
import type { EntityRow, Ledger, Op } from './ops';
import type { MovementView } from '../domain/read-models';
import { buildReorderList } from '../domain/reorder';

// Selectors: the read models the screens need, built from the ledger (the snapshot with the op log applied). The item
// read model is the `ItemView` type in `src/domain/read-models.ts`. Money fields are
// removed for staff here, in the selector, so they never reach a staff screen's props.

const SEARCH_LIMIT = 20;
const STATUS_ORDER = { out: 0, low: 1, ok: 2 } as const;

// One collator for every Thai sort: localeCompare with a locale builds a new Intl.Collator on each comparison, which
// made sorting the item list the slowest step of a page load on phones.
const thai = new Intl.Collator('th');

export type SupplierView = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  lineId: string | null;
  leadTimeDays: number;
  note: string | null;
};

export type CategoryView = {
  id: string;
  nameTh: string;
  nameEn: string | null;
  sort: number;
};

export type UnitView = {
  id: string;
  nameTh: string;
  nameEn: string | null;
  symbol: string;
};

const str = (value: unknown) => (value == null ? null : String(value));

function unitOf(row: EntityRow | undefined, fallback: string): Unit {
  return {
    id: row?.id ?? fallback,
    nameTh: String(row?.nameTh ?? ''),
    nameEn: str(row?.nameEn),
    symbol: String(row?.symbol ?? ''),
  };
}

/** Items as read models, with balance and status. Archived items are left out unless `includeInactive`. */
export function itemViews(
  ledger: Ledger,
  role: Role,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): ItemView[] {
  const rule = ledger.settings.lowStockRule as LowStockRule;
  const units = ledger.entities.unit;
  return Object.values(ledger.entities.item)
    .filter((row) => includeInactive || row.active !== false)
    .map((row) => {
      const id = row.id;
      const onHand = ledger.balances[id] ?? 0;
      const minQty = Number(row.minQty);
      const baseUnitId = String(row.baseUnitId);
      const packs =
        (row.packs as { unitId: string; factor: number }[] | undefined) ?? [];
      const view: ItemView = {
        id,
        sku: String(row.sku),
        barcode: str(row.barcode),
        nameTh: String(row.nameTh),
        nameEn: str(row.nameEn),
        categoryId: str(row.categoryId),
        supplierId: str(row.supplierId),
        location: str(row.location),
        imageUrl: str(row.imageUrl),
        active: row.active !== false,
        minQty,
        reorderQty: Number(row.reorderQty),
        onHand,
        status: itemStatus(onHand, minQty, rule),
        baseUnit: unitOf(units[baseUnitId], baseUnitId),
        packs: packs.map((pack) => ({
          unitId: pack.unitId,
          factor: pack.factor,
          unit: unitOf(units[pack.unitId], pack.unitId),
        })),
      };
      if (role === 'owner') {
        view.costSatang =
          row.costSatang == null ? null : Number(row.costSatang);
        view.priceSatang =
          row.priceSatang == null ? null : Number(row.priceSatang);
      }
      return view;
    })
    .sort((a, b) => thai.compare(a.nameTh, b.nameTh));
}

/** Active suppliers, by name. */
export function supplierViews(ledger: Ledger): SupplierView[] {
  return Object.values(ledger.entities.supplier)
    .map((row) => ({
      id: row.id,
      name: String(row.name),
      contactName: str(row.contactName),
      phone: str(row.phone),
      lineId: str(row.lineId),
      leadTimeDays: Number(row.leadTimeDays),
      note: str(row.note),
    }))
    .sort((a, b) => thai.compare(a.name, b.name));
}

export function categoryViews(ledger: Ledger): CategoryView[] {
  return Object.values(ledger.entities.category)
    .map((row) => ({
      id: row.id,
      nameTh: String(row.nameTh),
      nameEn: str(row.nameEn),
      sort: Number(row.sort ?? 0),
    }))
    .sort((a, b) => a.sort - b.sort || thai.compare(a.nameTh, b.nameTh));
}

export function unitViews(ledger: Ledger): UnitView[] {
  return Object.values(ledger.entities.unit)
    .map((row) => ({
      id: row.id,
      nameTh: String(row.nameTh),
      nameEn: str(row.nameEn),
      symbol: String(row.symbol),
    }))
    .sort((a, b) => thai.compare(a.nameTh, b.nameTh));
}

/**
 * Search for the quick-move field: exact barcode or SKU first, then names that start with the query, then names
 * that contain it. Ties sort by name. (The server search also ranks by trigram similarity; the browser version does
 * not, so a typo finds nothing here. S4 accepts that and records it.)
 */
export function searchViews(
  items: ItemView[],
  query: string,
  limit = SEARCH_LIMIT,
): ItemView[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rank = (item: ItemView): number => {
    if (item.barcode === query.trim() || item.sku.toLowerCase() === q) return 0;
    const starts = [item.nameTh, item.nameEn ?? '', item.sku].some((value) =>
      value.toLowerCase().startsWith(q),
    );
    if (starts) return 1;
    const contains = [item.nameTh, item.nameEn ?? '', item.sku].some((value) =>
      value.toLowerCase().includes(q),
    );
    return contains ? 2 : 3;
  };
  return items
    .map((item) => ({ item, rank: rank(item) }))
    .filter((entry) => entry.rank < 3)
    .sort(
      (a, b) => a.rank - b.rank || thai.compare(a.item.nameTh, b.item.nameTh),
    )
    .slice(0, limit)
    .map((entry) => entry.item);
}

/** Items to reorder or run out of, out first. */
export function lowViews(items: ItemView[]): ItemView[] {
  return items
    .filter((item) => item.status !== 'ok')
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        thai.compare(a.nameTh, b.nameTh),
    );
}

/** Scanner lookup: the exact barcode, or the SKU (any case). Null when no active item has the code. */
export function findByCode(items: ItemView[], code: string): ItemView | null {
  const value = code.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  return (
    items.find((item) => item.barcode === value) ??
    items.find((item) => item.sku.toLowerCase() === lower) ??
    null
  );
}

/** A barcode from this shop, for "Scan a sample". `pick` chooses among the candidates (random by default). */
export function sampleCode(
  items: ItemView[],
  pick: (count: number) => number = (count) =>
    Math.floor(Math.random() * count),
): string | null {
  const candidates = items.filter((item) => item.barcode);
  if (candidates.length === 0) return null;
  return candidates[pick(candidates.length)]?.barcode ?? null;
}

/** The given ids, in order, skipping any the shop no longer has. */
export function recentViews(items: ItemView[], ids: string[]): ItemView[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

export type ItemFilters = {
  query?: string;
  categoryId?: string;
  supplierId?: string;
  status?: 'out' | 'low' | 'ok';
  archived?: boolean;
};

/** The items list's filters (the URL holds them, see `UrlFilters`). Archived items show only when asked for. */
export function filterItems(
  items: ItemView[],
  filters: ItemFilters,
): ItemView[] {
  const q = filters.query?.trim().toLowerCase() ?? '';
  return items.filter((item) => {
    if (!filters.archived && !item.active) return false;
    if (filters.categoryId && item.categoryId !== filters.categoryId)
      return false;
    if (filters.supplierId && item.supplierId !== filters.supplierId)
      return false;
    if (filters.status && item.status !== filters.status) return false;
    if (!q) return true;
    return [item.nameTh, item.nameEn ?? '', item.sku, item.barcode ?? ''].some(
      (value) => value.toLowerCase().includes(q),
    );
  });
}

/** The ledger rows as the history screens show them. Owner-only cost is left out for staff. */
export function movementViews(
  ledger: Ledger,
  role: Role,
  { itemId, limit }: { itemId?: string; limit?: number } = {},
): MovementView[] {
  const units = ledger.entities.unit;
  const rows = ledger.movements
    .filter((movement) => !itemId || movement.itemId === itemId)
    .slice()
    .reverse();
  const limited = limit ? rows.slice(0, limit) : rows;
  return limited.flatMap((movement) => {
    const item = ledger.entities.item[movement.itemId];
    if (!item) return [];
    const baseUnit = unitOf(
      units[String(item.baseUnitId)],
      String(item.baseUnitId),
    );
    const enteredUnit = movement.enteredUnitId
      ? unitOf(units[movement.enteredUnitId], movement.enteredUnitId)
      : null;
    const userRole = (Object.keys(ledger.users) as Role[]).find(
      (key) => ledger.users[key].id === movement.userId,
    );
    const view: MovementView = {
      id: movement.id,
      occurredAt: new Date(movement.occurredAt),
      type: movement.type,
      reason: movement.reason,
      quantityBase: movement.quantityBase,
      enteredQty: movement.enteredQty,
      enteredUnit,
      balanceAfter: movement.balanceAfter,
      reference: movement.reference,
      note: movement.note,
      userName: userRole ? ledger.users[userRole].displayName : null,
      item: {
        id: movement.itemId,
        sku: String(item.sku),
        nameTh: String(item.nameTh),
        nameEn: str(item.nameEn),
        baseUnit,
      },
    };
    if (role === 'owner') view.unitCostSatang = movement.unitCostSatang;
    return [view];
  });
}

export type ChangeView = {
  id: string;
  at: Date;
  action: 'create' | 'update' | 'archive' | 'restore';
  userName: string | null;
  diff: Record<string, { before: unknown; after: unknown }>;
};

/**
 * The changes made to one item, from the op log, newest first. `baseline` is the item as the template had it (the
 * snapshot row), so the first visitor change is compared with it. Owner only.
 */
export function changeViews(
  ops: Op[],
  users: Ledger['users'],
  entityId: string,
  baseline: Record<string, unknown> | null,
): ChangeView[] {
  let previous: Record<string, unknown> | null = baseline;
  const changes: ChangeView[] = [];
  for (const op of ops) {
    if (
      op.kind !== 'entity.save' ||
      op.payload.entity !== 'item' ||
      op.payload.entityId !== entityId
    )
      continue;
    const next = op.payload.row;
    const userRole = op.role;
    const userName = users[userRole]?.displayName ?? null;
    if (!previous) {
      changes.push({
        id: op.id,
        at: new Date(op.at),
        action: 'create',
        userName,
        diff: {},
      });
    } else {
      const diff: ChangeView['diff'] = {};
      for (const key of Object.keys(next)) {
        if (JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
          diff[key] = { before: previous[key], after: next[key] };
      }
      const activeChange = diff.active;
      const action: ChangeView['action'] = activeChange
        ? activeChange.after === false
          ? 'archive'
          : 'restore'
        : 'update';
      if (Object.keys(diff).length > 0)
        changes.push({
          id: op.id,
          at: new Date(op.at),
          action,
          userName,
          diff,
        });
    }
    previous = next;
  }
  return changes.reverse();
}

export type OrderStatus =
  'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';

export type OrderLineView = {
  lineId: string;
  qtyBase: number;
  receivedBase: number;
  item: ItemView;
};

export type OrderView = {
  id: string;
  number: string;
  status: OrderStatus;
  supplierId: string | null;
  supplierName: string | null;
  orderedAt: Date | null;
  expectedAt: Date | null;
  receivedAt: Date | null;
  note: string | null;
  lines: number;
  remaining: number;
  items: OrderLineView[];
};

/** Purchase orders, newest first, with their lines resolved to items. Lines of archived items still show. */
export function orderViews(ledger: Ledger, role: Role): OrderView[] {
  const items = new Map(
    itemViews(ledger, role, { includeInactive: true }).map((item) => [
      item.id,
      item,
    ]),
  );
  const suppliers = ledger.entities.supplier;
  const dateOf = (value: unknown) =>
    value == null ? null : new Date(String(value));
  return Object.values(ledger.entities.order)
    .map((row) => {
      const lines =
        (row.lines as {
          id: string;
          itemId: string;
          qtyBase: number;
          receivedBase: number;
        }[]) ?? [];
      const supplier = row.supplierId
        ? suppliers[String(row.supplierId)]
        : undefined;
      const resolved = lines.flatMap((line) => {
        const item = items.get(line.itemId);
        return item
          ? [
              {
                lineId: line.id,
                qtyBase: line.qtyBase,
                receivedBase: line.receivedBase,
                item,
              },
            ]
          : [];
      });
      return {
        id: row.id,
        number: String(row.number),
        status: row.status as OrderStatus,
        supplierId: str(row.supplierId),
        supplierName: supplier ? String(supplier.name) : null,
        orderedAt: dateOf(row.orderedAt),
        expectedAt: dateOf(row.expectedAt),
        receivedAt: dateOf(row.receivedAt),
        note: str(row.note),
        lines: lines.length,
        remaining: lines.reduce(
          (sum, line) => sum + Math.max(0, line.qtyBase - line.receivedBase),
          0,
        ),
        items: resolved,
      };
    })
    .sort((a, b) => b.number.localeCompare(a.number));
}

/** Base units still on open orders, per item. */
export function onOrderByItem(ledger: Ledger): Map<string, number> {
  const totals = new Map<string, number>();
  for (const order of Object.values(ledger.entities.order)) {
    if (order.status !== 'ordered' && order.status !== 'partial') continue;
    for (const line of (order.lines as {
      itemId: string;
      qtyBase: number;
      receivedBase: number;
    }[]) ?? []) {
      const remaining = line.qtyBase - line.receivedBase;
      if (remaining > 0)
        totals.set(line.itemId, (totals.get(line.itemId) ?? 0) + remaining);
    }
  }
  return totals;
}

/** The next purchase order number, PO-0001 style. */
export function nextOrderNumber(ledger: Ledger): string {
  const highest = Object.values(ledger.entities.order).reduce((max, row) => {
    const match = /^PO-(\d+)$/.exec(String(row.number));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `PO-${String(highest + 1).padStart(4, '0')}`;
}

export type ReorderLineView = {
  itemId: string;
  sku: string;
  nameTh: string;
  nameEn: string | null;
  onHand: number;
  minQty: number;
  suggested: number;
  onOrder: number;
  baseUnit: ItemView['baseUnit'];
  pack: { unit: ItemView['baseUnit']; factor: number } | null;
};

export type ReorderGroupView = {
  supplier: {
    id: string;
    name: string;
    phone: string | null;
    lineId: string | null;
    leadTimeDays: number;
  } | null;
  lines: ReorderLineView[];
};

/** This week's reorder list, from the same rule as `src/domain/reorder.ts` (suggestions and grouping by supplier). */
export function reorderGroups(ledger: Ledger, role: Role): ReorderGroupView[] {
  const items = itemViews(ledger, role);
  const onOrder = onOrderByItem(ledger);
  const byId = new Map(items.map((item) => [item.id, item]));
  const groups = buildReorderList(
    items.map((view) => ({
      itemId: view.id,
      supplierId: view.supplierId,
      onHand: view.onHand,
      minQty: view.minQty,
      reorderQty: view.reorderQty,
      packFactor: view.packs.at(-1)?.factor ?? 1,
      onOrder: onOrder.get(view.id) ?? 0,
    })),
    ledger.settings.lowStockRule,
  );
  return groups.map((group) => {
    const supplier = group.supplierId
      ? ledger.entities.supplier[group.supplierId]
      : undefined;
    return {
      supplier:
        group.supplierId && supplier
          ? {
              id: group.supplierId,
              name: String(supplier.name),
              phone: str(supplier.phone),
              lineId: str(supplier.lineId),
              leadTimeDays: Number(supplier.leadTimeDays),
            }
          : null,
      lines: group.lines.map((line) => {
        const view = byId.get(line.itemId)!;
        const pack = view.packs.at(-1);
        return {
          itemId: view.id,
          sku: view.sku,
          nameTh: view.nameTh,
          nameEn: view.nameEn,
          onHand: view.onHand,
          minQty: view.minQty,
          suggested: line.suggested,
          onOrder: line.onOrder,
          baseUnit: view.baseUnit,
          pack: pack ? { unit: pack.unit, factor: pack.factor } : null,
        };
      }),
    };
  });
}

export type CountStatusView = 'open' | 'submitted' | 'approved';

export type CountSummaryView = {
  id: string;
  number: string;
  status: CountStatusView;
  blind: boolean;
  startedAt: Date;
  approvedAt: Date | null;
  categoryName: { nameTh: string; nameEn: string | null } | null;
  total: number;
  counted: number;
  startedBy: string | null;
};

export type CountLineView = {
  itemId: string;
  /** Null while a blind count is open and the line is not counted yet: the page does not show it. */
  expected: number | null;
  counted: number | null;
  item: ItemView;
};

/** Stock counts, newest first. */
export function countViews(ledger: Ledger): CountSummaryView[] {
  const categories = ledger.entities.category;
  const users = ledger.users;
  return Object.values(ledger.entities.count)
    .map((row) => {
      const lines = (row.lines as { counted: number | null }[]) ?? [];
      const scope = row.scope as { kind: string; categoryId?: string };
      const category =
        scope.kind === 'category' && scope.categoryId
          ? categories[scope.categoryId]
          : undefined;
      const startedBy = (Object.keys(users) as Role[]).find(
        (key) => users[key].id === row.startedBy,
      );
      return {
        id: row.id,
        number: String(row.number),
        status: row.status as CountStatusView,
        blind: Boolean(row.blind),
        startedAt: new Date(String(row.startedAt)),
        approvedAt:
          row.approvedAt == null ? null : new Date(String(row.approvedAt)),
        categoryName: category
          ? { nameTh: String(category.nameTh), nameEn: str(category.nameEn) }
          : null,
        total: lines.length,
        counted: lines.filter((line) => line.counted !== null).length,
        startedBy: startedBy ? users[startedBy].displayName : null,
      };
    })
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/** One count with its lines resolved to items. Expected stays hidden on a blind count until the line is counted. */
export function countDetail(
  ledger: Ledger,
  id: string,
  role: Role,
): (CountSummaryView & { lines: CountLineView[] }) | null {
  const summary = countViews(ledger).find((entry) => entry.id === id);
  if (!summary) return null;
  const session = ledger.entities.count[id]!;
  const items = new Map(
    itemViews(ledger, role, { includeInactive: true }).map((item) => [
      item.id,
      item,
    ]),
  );
  const lines = (
    session.lines as {
      itemId: string;
      expected: number;
      counted: number | null;
    }[]
  )
    .flatMap((line) => {
      const item = items.get(line.itemId);
      if (!item) return [];
      const hidden =
        summary.blind && summary.status === 'open' && line.counted === null;
      return [
        {
          itemId: line.itemId,
          expected: hidden ? null : line.expected,
          counted: line.counted,
          item,
        },
      ];
    })
    .sort((a, b) => a.item.sku.localeCompare(b.item.sku));
  return { ...summary, lines };
}
