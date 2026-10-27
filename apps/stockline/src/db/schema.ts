import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Stockline tables (02 §5). Every table has tenant_id + an index and created_at. Foreign keys include tenant_id,
// so a row can only point at rows of its own tenant. Template rows (the seed) keep relative dates in `days_ago`
// (+ `minute_of_day`); clone_demo_tenant turns them into real timestamps for "today" in Asia/Bangkok.

export const stockline = pgSchema('stockline');

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const shopSettings = stockline.table(
  'shop_settings',
  {
    tenantId: uuid('tenant_id').notNull(),
    shopNameTh: text('shop_name_th').notNull(),
    shopNameEn: text('shop_name_en'),
    /** `at_or_below_min` (02 §4: low if on_hand ≤ min) or `below_min` (strictly under). */
    lowStockRule: text('low_stock_rule').notNull().default('at_or_below_min'),
    /** ISO weekday, 1 = Monday (02 §3.1 item 11). */
    reorderWeekday: integer('reorder_weekday').notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId] }),
    check(
      'shop_settings_low_stock_rule_valid',
      sql`${t.lowStockRule} in ('at_or_below_min', 'below_min')`,
    ),
    check(
      'shop_settings_reorder_weekday_valid',
      sql`${t.reorderWeekday} between 1 and 7`,
    ),
  ],
);

export const unit = stockline.table(
  'unit',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    nameTh: text('name_th').notNull(),
    nameEn: text('name_en'),
    symbol: text('symbol').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('unit_tenant_idx').on(t.tenantId),
    unique('unit_tenant_id_uq').on(t.tenantId, t.id),
  ],
);

export const category = stockline.table(
  'category',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    nameTh: text('name_th').notNull(),
    nameEn: text('name_en'),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('category_tenant_idx').on(t.tenantId),
    unique('category_tenant_id_uq').on(t.tenantId, t.id),
  ],
);

export const supplier = stockline.table(
  'supplier',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    /** E.164 (`+66812345678`); shown as 081-234-5678. */
    phone: text('phone'),
    lineId: text('line_id'),
    leadTimeDays: integer('lead_time_days').notNull().default(1),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('supplier_tenant_idx').on(t.tenantId),
    unique('supplier_tenant_id_uq').on(t.tenantId, t.id),
    check('supplier_lead_time_nonnegative', sql`${t.leadTimeDays} >= 0`),
  ],
);

export const appUser = stockline.table(
  'app_user',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('app_user_tenant_idx').on(t.tenantId),
    unique('app_user_tenant_id_uq').on(t.tenantId, t.id),
    check('app_user_role_valid', sql`${t.role} in ('owner', 'staff')`),
  ],
);

export const item = stockline.table(
  'item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    sku: text('sku').notNull(),
    barcode: text('barcode'),
    nameTh: text('name_th').notNull(),
    nameEn: text('name_en'),
    categoryId: uuid('category_id'),
    baseUnitId: uuid('base_unit_id').notNull(),
    /** Per base unit, in satang. Owner only (02 §2). Moving average, updated on `in` with a cost. */
    costSatang: bigint('cost_satang', { mode: 'number' }),
    priceSatang: bigint('price_satang', { mode: 'number' }),
    minQty: integer('min_qty').notNull().default(0),
    reorderQty: integer('reorder_qty').notNull().default(0),
    supplierId: uuid('supplier_id'),
    location: text('location'),
    imageUrl: text('image_url'),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index('item_tenant_idx').on(t.tenantId),
    index('item_active_category_idx').on(t.tenantId, t.active, t.categoryId),
    unique('item_tenant_sku_uq').on(t.tenantId, t.sku),
    unique('item_tenant_barcode_uq').on(t.tenantId, t.barcode),
    unique('item_tenant_id_uq').on(t.tenantId, t.id),
    foreignKey({
      name: 'item_category_fk',
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [category.tenantId, category.id],
    }),
    foreignKey({
      name: 'item_base_unit_fk',
      columns: [t.tenantId, t.baseUnitId],
      foreignColumns: [unit.tenantId, unit.id],
    }),
    foreignKey({
      name: 'item_supplier_fk',
      columns: [t.tenantId, t.supplierId],
      foreignColumns: [supplier.tenantId, supplier.id],
    }),
    check('item_min_qty_nonnegative', sql`${t.minQty} >= 0`),
    check('item_reorder_qty_nonnegative', sql`${t.reorderQty} >= 0`),
    check('item_cost_nonnegative', sql`${t.costSatang} >= 0`),
    check('item_price_nonnegative', sql`${t.priceSatang} >= 0`),
  ],
);

/** Pack units: 1 `unit` = `factor` base units of the item (1 ลัง = 24 ขวด). */
export const itemUnit = stockline.table(
  'item_unit',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    itemId: uuid('item_id').notNull(),
    unitId: uuid('unit_id').notNull(),
    factor: integer('factor').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('item_unit_tenant_idx').on(t.tenantId),
    unique('item_unit_item_unit_uq').on(t.tenantId, t.itemId, t.unitId),
    foreignKey({
      name: 'item_unit_item_fk',
      columns: [t.tenantId, t.itemId],
      foreignColumns: [item.tenantId, item.id],
    }),
    foreignKey({
      name: 'item_unit_unit_fk',
      columns: [t.tenantId, t.unitId],
      foreignColumns: [unit.tenantId, unit.id],
    }),
    check('item_unit_factor_gt_one', sql`${t.factor} > 1`),
  ],
);

export const purchaseOrder = stockline.table(
  'purchase_order',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    number: text('number').notNull(),
    supplierId: uuid('supplier_id'),
    status: text('status').notNull(),
    orderedAt: timestamp('ordered_at', { withTimezone: true }),
    expectedAt: timestamp('expected_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    note: text('note'),
    createdBy: uuid('created_by'),
    orderedDaysAgo: integer('ordered_days_ago'),
    expectedDaysAgo: integer('expected_days_ago'),
    receivedDaysAgo: integer('received_days_ago'),
    createdAt: createdAt(),
  },
  (t) => [
    index('purchase_order_tenant_idx').on(t.tenantId),
    index('purchase_order_status_idx').on(t.tenantId, t.status),
    unique('purchase_order_tenant_id_uq').on(t.tenantId, t.id),
    unique('purchase_order_number_uq').on(t.tenantId, t.number),
    foreignKey({
      name: 'purchase_order_supplier_fk',
      columns: [t.tenantId, t.supplierId],
      foreignColumns: [supplier.tenantId, supplier.id],
    }),
    foreignKey({
      name: 'purchase_order_created_by_fk',
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [appUser.tenantId, appUser.id],
    }),
    check(
      'purchase_order_status_valid',
      sql`${t.status} in ('draft', 'ordered', 'partial', 'received', 'cancelled')`,
    ),
  ],
);

export const purchaseOrderLine = stockline.table(
  'purchase_order_line',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    purchaseOrderId: uuid('purchase_order_id').notNull(),
    itemId: uuid('item_id').notNull(),
    qtyBase: integer('qty_base').notNull(),
    receivedBase: integer('received_base').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('purchase_order_line_tenant_idx').on(t.tenantId),
    index('purchase_order_line_order_idx').on(t.tenantId, t.purchaseOrderId),
    unique('purchase_order_line_item_uq').on(
      t.tenantId,
      t.purchaseOrderId,
      t.itemId,
    ),
    foreignKey({
      name: 'purchase_order_line_order_fk',
      columns: [t.tenantId, t.purchaseOrderId],
      foreignColumns: [purchaseOrder.tenantId, purchaseOrder.id],
    }),
    foreignKey({
      name: 'purchase_order_line_item_fk',
      columns: [t.tenantId, t.itemId],
      foreignColumns: [item.tenantId, item.id],
    }),
    check('purchase_order_line_qty_positive', sql`${t.qtyBase} > 0`),
    check(
      'purchase_order_line_received_nonnegative',
      sql`${t.receivedBase} >= 0`,
    ),
  ],
);

export const countSession = stockline.table(
  'count_session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    number: text('number').notNull(),
    /** `{ kind: 'all' }` or `{ kind: 'category', categoryId }`. */
    scope: jsonb('scope')
      .$type<{ kind: 'all' } | { kind: 'category'; categoryId: string }>()
      .notNull(),
    status: text('status').notNull(),
    /** Expected quantities stay hidden until a line is counted. */
    blind: boolean('blind').notNull().default(false),
    startedBy: uuid('started_by'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    daysAgo: integer('days_ago'),
    createdAt: createdAt(),
  },
  (t) => [
    index('count_session_tenant_idx').on(t.tenantId),
    unique('count_session_tenant_id_uq').on(t.tenantId, t.id),
    unique('count_session_number_uq').on(t.tenantId, t.number),
    foreignKey({
      name: 'count_session_started_by_fk',
      columns: [t.tenantId, t.startedBy],
      foreignColumns: [appUser.tenantId, appUser.id],
    }),
    foreignKey({
      name: 'count_session_approved_by_fk',
      columns: [t.tenantId, t.approvedBy],
      foreignColumns: [appUser.tenantId, appUser.id],
    }),
    check(
      'count_session_status_valid',
      sql`${t.status} in ('open', 'submitted', 'approved')`,
    ),
  ],
);

export const countLine = stockline.table(
  'count_line',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    countSessionId: uuid('count_session_id').notNull(),
    itemId: uuid('item_id').notNull(),
    /** On hand when the count started. */
    expected: integer('expected').notNull(),
    /** Null until counted. */
    counted: integer('counted'),
    countedAt: timestamp('counted_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('count_line_tenant_idx').on(t.tenantId),
    index('count_line_session_idx').on(t.tenantId, t.countSessionId),
    unique('count_line_item_uq').on(t.tenantId, t.countSessionId, t.itemId),
    foreignKey({
      name: 'count_line_session_fk',
      columns: [t.tenantId, t.countSessionId],
      foreignColumns: [countSession.tenantId, countSession.id],
    }),
    foreignKey({
      name: 'count_line_item_fk',
      columns: [t.tenantId, t.itemId],
      foreignColumns: [item.tenantId, item.id],
    }),
    check('count_line_counted_nonnegative', sql`${t.counted} >= 0`),
  ],
);

/** The ledger (02 §4): append-only, enforced by a trigger and revoked privileges (migration 0001). */
export const stockMovement = stockline.table(
  'stock_movement',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    itemId: uuid('item_id').notNull(),
    type: text('type').notNull(),
    reason: text('reason').notNull(),
    /** Signed, in the item's base unit: in > 0, out < 0, adjust ±. */
    quantityBase: integer('quantity_base').notNull(),
    /** As typed, for display ("2 ลัง"). */
    enteredQty: numeric('entered_qty', { mode: 'number' }),
    enteredUnitId: uuid('entered_unit_id'),
    unitCostSatang: bigint('unit_cost_satang', { mode: 'number' }),
    reference: text('reference'),
    purchaseOrderId: uuid('purchase_order_id'),
    countSessionId: uuid('count_session_id'),
    note: text('note'),
    userId: uuid('user_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    balanceAfter: integer('balance_after').notNull(),
    daysAgo: integer('days_ago'),
    minuteOfDay: integer('minute_of_day'),
    createdAt: createdAt(),
  },
  (t) => [
    index('stock_movement_tenant_idx').on(t.tenantId),
    index('stock_movement_tenant_item_occurred_idx').on(
      t.tenantId,
      t.itemId,
      t.occurredAt.desc(),
    ),
    index('stock_movement_tenant_occurred_idx').on(
      t.tenantId,
      t.occurredAt.desc(),
    ),
    foreignKey({
      name: 'stock_movement_item_fk',
      columns: [t.tenantId, t.itemId],
      foreignColumns: [item.tenantId, item.id],
    }),
    foreignKey({
      name: 'stock_movement_unit_fk',
      columns: [t.tenantId, t.enteredUnitId],
      foreignColumns: [unit.tenantId, unit.id],
    }),
    foreignKey({
      name: 'stock_movement_order_fk',
      columns: [t.tenantId, t.purchaseOrderId],
      foreignColumns: [purchaseOrder.tenantId, purchaseOrder.id],
    }),
    foreignKey({
      name: 'stock_movement_count_fk',
      columns: [t.tenantId, t.countSessionId],
      foreignColumns: [countSession.tenantId, countSession.id],
    }),
    foreignKey({
      name: 'stock_movement_user_fk',
      columns: [t.tenantId, t.userId],
      foreignColumns: [appUser.tenantId, appUser.id],
    }),
    check(
      'stock_movement_type_valid',
      sql`${t.type} in ('in', 'out', 'adjust')`,
    ),
    check(
      'stock_movement_sign_valid',
      sql`(${t.type} = 'in' and ${t.quantityBase} > 0) or (${t.type} = 'out' and ${t.quantityBase} < 0) or (${t.type} = 'adjust' and ${t.quantityBase} <> 0)`,
    ),
  ],
);

/** On hand per item, updated in the same transaction as each movement (SELECT … FOR UPDATE serializes moves). */
export const itemBalance = stockline.table(
  'item_balance',
  {
    itemId: uuid('item_id').notNull(),
    tenantId: uuid('tenant_id').notNull(),
    onHand: integer('on_hand').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId] }),
    index('item_balance_tenant_idx').on(t.tenantId),
    foreignKey({
      name: 'item_balance_item_fk',
      columns: [t.tenantId, t.itemId],
      foreignColumns: [item.tenantId, item.id],
    }),
  ],
);

/** Master-data history (02 §5): who changed what, with before/after. */
export const auditEvent = stockline.table(
  'audit_event',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id'),
    diff: jsonb('diff')
      .$type<Record<string, { before: unknown; after: unknown }>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    daysAgo: integer('days_ago'),
    minuteOfDay: integer('minute_of_day'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_event_tenant_idx').on(t.tenantId),
    index('audit_event_entity_idx').on(t.tenantId, t.entity, t.entityId),
    foreignKey({
      name: 'audit_event_user_fk',
      columns: [t.tenantId, t.userId],
      foreignColumns: [appUser.tenantId, appUser.id],
    }),
  ],
);
