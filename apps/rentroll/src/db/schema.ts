import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Rentroll tables (01 §5). Every table has tenant_id (the demo sandbox, not the renter) + created_at. Money is
// integer satang. Template rows keep relative dates in `days_ago`; clone_demo_tenant turns them into real
// timestamps for "today" in Asia/Bangkok.

export const rentroll = pgSchema('rentroll');

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const building = rentroll.table(
  'building',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    nameTh: text('name_th').notNull(),
    nameEn: text('name_en'),
    addressTh: text('address_th'),
    addressEn: text('address_en'),
    /** Demo-fake PromptPay ID (01 §6.3). Never a real person's number. */
    promptpayId: text('promptpay_id').notNull(),
    bankName: text('bank_name'),
    bankAccountMasked: text('bank_account_masked'),
    billingDay: smallint('billing_day').notNull().default(25),
    dueDay: smallint('due_day').notNull().default(5),
    invoiceYearStyle: text('invoice_year_style').notNull().default('be'),
    createdAt: createdAt(),
  },
  (t) => [
    index('building_tenant_idx').on(t.tenantId),
    unique('building_tenant_id_uq').on(t.tenantId, t.id),
    check('building_billing_day_valid', sql`${t.billingDay} between 1 and 28`),
    check('building_due_day_valid', sql`${t.dueDay} between 1 and 28`),
    check(
      'building_invoice_year_style_valid',
      sql`${t.invoiceYearStyle} in ('be', 'ce')`,
    ),
  ],
);

export const ratePlan = rentroll.table(
  'rate_plan',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    buildingId: uuid('building_id').notNull(),
    validFrom: date('valid_from').notNull(),
    elecRateSatang: integer('elec_rate_satang').notNull(),
    elecMinSatang: integer('elec_min_satang').notNull().default(0),
    waterMode: text('water_mode').notNull(),
    waterRateSatang: integer('water_rate_satang').notNull().default(0),
    waterMinSatang: integer('water_min_satang').notNull().default(0),
    waterPerPersonSatang: integer('water_per_person_satang').notNull().default(0),
    commonFeeSatang: integer('common_fee_satang').notNull().default(0),
    lateFeeRule: jsonb('late_fee_rule')
      .$type<{ kind: 'per_day' | 'once'; amountSatang: number; capSatang: number }>()
      .notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('rate_plan_tenant_idx').on(t.tenantId),
    index('rate_plan_building_idx').on(t.tenantId, t.buildingId, t.validFrom),
    unique('rate_plan_tenant_id_uq').on(t.tenantId, t.id),
    foreignKey({
      name: 'rate_plan_building_fk',
      columns: [t.tenantId, t.buildingId],
      foreignColumns: [building.tenantId, building.id],
    }),
    check(
      'rate_plan_water_mode_valid',
      sql`${t.waterMode} in ('per_unit', 'per_person')`,
    ),
  ],
);

export const roomType = rentroll.table(
  'room_type',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    buildingId: uuid('building_id').notNull(),
    nameTh: text('name_th').notNull(),
    nameEn: text('name_en'),
    monthlyRentSatang: bigint('monthly_rent_satang', { mode: 'number' }).notNull(),
    dailyRentSatang: bigint('daily_rent_satang', { mode: 'number' }),
    depositSatang: bigint('deposit_satang', { mode: 'number' }).notNull(),
    advanceMonths: smallint('advance_months').notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    index('room_type_tenant_idx').on(t.tenantId),
    unique('room_type_tenant_id_uq').on(t.tenantId, t.id),
    foreignKey({
      name: 'room_type_building_fk',
      columns: [t.tenantId, t.buildingId],
      foreignColumns: [building.tenantId, building.id],
    }),
    check('room_type_rent_nonnegative', sql`${t.monthlyRentSatang} >= 0`),
    check('room_type_deposit_nonnegative', sql`${t.depositSatang} >= 0`),
  ],
);

export const room = rentroll.table(
  'room',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    buildingId: uuid('building_id').notNull(),
    number: text('number').notNull(),
    floor: smallint('floor').notNull(),
    roomTypeId: uuid('room_type_id').notNull(),
    sizeSqm: numeric('size_sqm', { mode: 'number' }),
    /** Set by hand only for `maintenance`; every other status comes from contracts (01 §4). */
    maintenance: boolean('maintenance').notNull().default(false),
    elecMeterDigits: smallint('elec_meter_digits').notNull().default(5),
    waterMeterDigits: smallint('water_meter_digits').notNull().default(4),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('room_tenant_idx').on(t.tenantId),
    index('room_building_floor_idx').on(t.tenantId, t.buildingId, t.floor),
    unique('room_tenant_id_uq').on(t.tenantId, t.id),
    unique('room_building_number_uq').on(t.tenantId, t.buildingId, t.number),
    foreignKey({
      name: 'room_building_fk',
      columns: [t.tenantId, t.buildingId],
      foreignColumns: [building.tenantId, building.id],
    }),
    foreignKey({
      name: 'room_room_type_fk',
      columns: [t.tenantId, t.roomTypeId],
      foreignColumns: [roomType.tenantId, roomType.id],
    }),
  ],
);

export const renter = rentroll.table(
  'renter',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    name: text('name').notNull(),
    /** E.164 (`+66812345678`). */
    phone: text('phone'),
    lineUserId: text('line_user_id'),
    preferredLocale: text('preferred_locale').notNull().default('th'),
    emergencyContact: jsonb('emergency_contact').$type<{ name: string; phone: string }>(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('renter_tenant_idx').on(t.tenantId),
    unique('renter_tenant_id_uq').on(t.tenantId, t.id),
    check(
      'renter_locale_valid',
      sql`${t.preferredLocale} in ('th', 'en')`,
    ),
  ],
);

export const contract = rentroll.table(
  'contract',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    roomId: uuid('room_id').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    noticeDate: date('notice_date'),
    status: text('status').notNull(),
    monthlyRentSatang: bigint('monthly_rent_satang', { mode: 'number' }).notNull(),
    depositSatang: bigint('deposit_satang', { mode: 'number' }).notNull(),
    depositReceivedSatang: bigint('deposit_received_satang', { mode: 'number' }).notNull().default(0),
    advanceMonths: smallint('advance_months').notNull().default(1),
    occupants: smallint('occupants').notNull().default(1),
    extras: jsonb('extras').$type<{ parking?: number; internet?: number }>().notNull().default(sql`'{}'::jsonb`),
    note: text('note'),
    /** Relative dates for template rows (clone_demo_tenant); negative = in the future. */
    startDaysAgo: integer('start_days_ago'),
    noticeDaysAgo: integer('notice_days_ago'),
    endDaysAgo: integer('end_days_ago'),
    createdAt: createdAt(),
  },
  (t) => [
    index('contract_tenant_idx').on(t.tenantId),
    index('contract_room_status_idx').on(t.tenantId, t.roomId, t.status),
    unique('contract_tenant_id_uq').on(t.tenantId, t.id),
    // One active or notice-given contract per room (01 §5).
    uniqueIndex('contract_one_live_per_room_uq')
      .on(t.tenantId, t.roomId)
      .where(sql`${t.status} in ('active', 'notice_given')`),
    foreignKey({
      name: 'contract_room_fk',
      columns: [t.tenantId, t.roomId],
      foreignColumns: [room.tenantId, room.id],
    }),
    check(
      'contract_status_valid',
      sql`${t.status} in ('active', 'notice_given', 'ended')`,
    ),
    check('contract_occupants_valid', sql`${t.occupants} between 1 and 4`),
  ],
);

export const contractRenter = rentroll.table(
  'contract_renter',
  {
    tenantId: uuid('tenant_id').notNull(),
    contractId: uuid('contract_id').notNull(),
    renterId: uuid('renter_id').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('contract_renter_tenant_idx').on(t.tenantId),
    unique('contract_renter_uq').on(t.tenantId, t.contractId, t.renterId),
    foreignKey({
      name: 'contract_renter_contract_fk',
      columns: [t.tenantId, t.contractId],
      foreignColumns: [contract.tenantId, contract.id],
    }),
    foreignKey({
      name: 'contract_renter_renter_fk',
      columns: [t.tenantId, t.renterId],
      foreignColumns: [renter.tenantId, renter.id],
    }),
  ],
);

export const meterReading = rentroll.table(
  'meter_reading',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    roomId: uuid('room_id').notNull(),
    kind: text('kind').notNull(),
    /** `YYYY-MM` C.E. */
    period: char('period', { length: 7 }).notNull(),
    reading: integer('reading').notNull(),
    unitsUsed: integer('units_used'),
    isRollover: boolean('is_rollover').notNull().default(false),
    isEstimate: boolean('is_estimate').notNull().default(false),
    photoUrl: text('photo_url'),
    anomaly: text('anomaly'),
    readBy: text('read_by'),
    readAt: timestamp('read_at', { withTimezone: true }),
    daysAgo: integer('days_ago'),
    createdAt: createdAt(),
  },
  (t) => [
    index('meter_reading_tenant_idx').on(t.tenantId),
    index('meter_reading_period_idx').on(t.tenantId, t.period),
    unique('meter_reading_uq').on(t.tenantId, t.roomId, t.kind, t.period),
    foreignKey({
      name: 'meter_reading_room_fk',
      columns: [t.tenantId, t.roomId],
      foreignColumns: [room.tenantId, room.id],
    }),
    check('meter_reading_kind_valid', sql`${t.kind} in ('electricity', 'water')`),
    check('meter_reading_nonnegative', sql`${t.reading} >= 0`),
  ],
);

export const invoice = rentroll.table(
  'invoice',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    buildingId: uuid('building_id').notNull(),
    contractId: uuid('contract_id').notNull(),
    number: text('number').notNull(),
    type: text('type').notNull(),
    period: char('period', { length: 7 }),
    issueDate: date('issue_date').notNull(),
    dueDate: date('due_date').notNull(),
    status: text('status').notNull(),
    subtotalSatang: bigint('subtotal_satang', { mode: 'number' }).notNull(),
    totalSatang: bigint('total_satang', { mode: 'number' }).notNull(),
    paidSatang: bigint('paid_satang', { mode: 'number' }).notNull().default(0),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    /** Signed link token for the tenant's invoice page (01 §6.1). */
    publicToken: text('public_token').notNull(),
    daysAgo: integer('days_ago'),
    createdAt: createdAt(),
  },
  (t) => [
    index('invoice_tenant_idx').on(t.tenantId),
    index('invoice_building_period_idx').on(t.tenantId, t.buildingId, t.period),
    index('invoice_status_due_idx').on(t.tenantId, t.status, t.dueDate),
    unique('invoice_tenant_id_uq').on(t.tenantId, t.id),
    unique('invoice_number_uq').on(t.tenantId, t.number),
    unique('invoice_public_token_uq').on(t.publicToken),
    unique('invoice_contract_period_type_uq').on(t.contractId, t.period, t.type),
    foreignKey({
      name: 'invoice_building_fk',
      columns: [t.tenantId, t.buildingId],
      foreignColumns: [building.tenantId, building.id],
    }),
    foreignKey({
      name: 'invoice_contract_fk',
      columns: [t.tenantId, t.contractId],
      foreignColumns: [contract.tenantId, contract.id],
    }),
    check(
      'invoice_type_valid',
      sql`${t.type} in ('monthly', 'move_in', 'move_out', 'one_off')`,
    ),
    check(
      'invoice_status_valid',
      sql`${t.status} in ('draft', 'sent', 'partially_paid', 'paid', 'void')`,
    ),
    check('invoice_total_nonnegative', sql`${t.totalSatang} >= 0`),
  ],
);

export const invoiceLine = rentroll.table(
  'invoice_line',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    kind: text('kind').notNull(),
    labelTh: text('label_th').notNull(),
    labelEn: text('label_en').notNull(),
    qty: numeric('qty', { mode: 'number' }).notNull().default(1),
    unitPriceSatang: bigint('unit_price_satang', { mode: 'number' }).notNull(),
    amountSatang: bigint('amount_satang', { mode: 'number' }).notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    index('invoice_line_tenant_idx').on(t.tenantId),
    index('invoice_line_invoice_idx').on(t.tenantId, t.invoiceId),
    foreignKey({
      name: 'invoice_line_invoice_fk',
      columns: [t.tenantId, t.invoiceId],
      foreignColumns: [invoice.tenantId, invoice.id],
    }),
  ],
);

export const payment = rentroll.table(
  'payment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    contractId: uuid('contract_id').notNull(),
    amountSatang: bigint('amount_satang', { mode: 'number' }).notNull(),
    method: text('method').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    slipUrl: text('slip_url'),
    status: text('status').notNull(),
    reviewedBy: text('reviewed_by'),
    rejectReason: text('reject_reason'),
    receiptNumber: text('receipt_number'),
    daysAgo: integer('days_ago'),
    minuteOfDay: integer('minute_of_day'),
    createdAt: createdAt(),
  },
  (t) => [
    index('payment_tenant_idx').on(t.tenantId),
    index('payment_status_idx').on(t.tenantId, t.status),
    unique('payment_tenant_id_uq').on(t.tenantId, t.id),
    foreignKey({
      name: 'payment_contract_fk',
      columns: [t.tenantId, t.contractId],
      foreignColumns: [contract.tenantId, contract.id],
    }),
    check('payment_amount_positive', sql`${t.amountSatang} > 0`),
    check(
      'payment_method_valid',
      sql`${t.method} in ('promptpay', 'transfer', 'cash')`,
    ),
    check(
      'payment_status_valid',
      sql`${t.status} in ('pending_review', 'approved', 'rejected')`,
    ),
  ],
);

export const paymentAllocation = rentroll.table(
  'payment_allocation',
  {
    tenantId: uuid('tenant_id').notNull(),
    paymentId: uuid('payment_id').notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    amountSatang: bigint('amount_satang', { mode: 'number' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('payment_allocation_tenant_idx').on(t.tenantId),
    unique('payment_allocation_uq').on(t.tenantId, t.paymentId, t.invoiceId),
    foreignKey({
      name: 'payment_allocation_payment_fk',
      columns: [t.tenantId, t.paymentId],
      foreignColumns: [payment.tenantId, payment.id],
    }),
    foreignKey({
      name: 'payment_allocation_invoice_fk',
      columns: [t.tenantId, t.invoiceId],
      foreignColumns: [invoice.tenantId, invoice.id],
    }),
  ],
);

export const creditNote = rentroll.table(
  'credit_note',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    number: text('number').notNull(),
    amountSatang: bigint('amount_satang', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('credit_note_tenant_idx').on(t.tenantId),
    unique('credit_note_number_uq').on(t.tenantId, t.number),
    foreignKey({
      name: 'credit_note_invoice_fk',
      columns: [t.tenantId, t.invoiceId],
      foreignColumns: [invoice.tenantId, invoice.id],
    }),
    check('credit_note_amount_positive', sql`${t.amountSatang} > 0`),
  ],
);

export const checklist = rentroll.table(
  'checklist',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    contractId: uuid('contract_id').notNull(),
    kind: text('kind').notNull(),
    items: jsonb('items')
      .$type<{ key: string; labelTh: string; labelEn: string; status: 'ok' | 'damaged' | null }[]>()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('checklist_tenant_idx').on(t.tenantId),
    unique('checklist_contract_kind_uq').on(t.tenantId, t.contractId, t.kind),
    foreignKey({
      name: 'checklist_contract_fk',
      columns: [t.tenantId, t.contractId],
      foreignColumns: [contract.tenantId, contract.id],
    }),
    check('checklist_kind_valid', sql`${t.kind} in ('move_in', 'move_out')`),
  ],
);

export const settlement = rentroll.table(
  'settlement',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    contractId: uuid('contract_id').notNull(),
    depositSatang: bigint('deposit_satang', { mode: 'number' }).notNull(),
    deductions: jsonb('deductions')
      .$type<{ key: string; labelTh: string; labelEn: string; amountSatang: number }[]>()
      .notNull(),
    refundSatang: bigint('refund_satang', { mode: 'number' }).notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('settlement_tenant_idx').on(t.tenantId),
    unique('settlement_contract_uq').on(t.tenantId, t.contractId),
    foreignKey({
      name: 'settlement_contract_fk',
      columns: [t.tenantId, t.contractId],
      foreignColumns: [contract.tenantId, contract.id],
    }),
  ],
);

export const repairTicket = rentroll.table(
  'repair_ticket',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    roomId: uuid('room_id').notNull(),
    renterId: uuid('renter_id'),
    category: text('category').notNull(),
    description: text('description').notNull(),
    photoUrl: text('photo_url'),
    preferredTime: text('preferred_time'),
    allowEntry: boolean('allow_entry').notNull().default(false),
    status: text('status').notNull(),
    assignee: text('assignee'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    costSatang: bigint('cost_satang', { mode: 'number' }),
    billToRenter: boolean('bill_to_renter').notNull().default(false),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    daysAgo: integer('days_ago'),
    minuteOfDay: integer('minute_of_day'),
    createdAt: createdAt(),
  },
  (t) => [
    index('repair_ticket_tenant_idx').on(t.tenantId),
    index('repair_ticket_status_idx').on(t.tenantId, t.status),
    unique('repair_ticket_tenant_id_uq').on(t.tenantId, t.id),
    foreignKey({
      name: 'repair_ticket_room_fk',
      columns: [t.tenantId, t.roomId],
      foreignColumns: [room.tenantId, room.id],
    }),
    foreignKey({
      name: 'repair_ticket_renter_fk',
      columns: [t.tenantId, t.renterId],
      foreignColumns: [renter.tenantId, renter.id],
    }),
    check(
      'repair_ticket_category_valid',
      sql`${t.category} in ('electrical', 'plumbing', 'aircon', 'furniture', 'internet', 'other')`,
    ),
    check(
      'repair_ticket_status_valid',
      sql`${t.status} in ('new', 'scheduled', 'in_progress', 'done', 'cancelled')`,
    ),
  ],
);

export const ticketMessage = rentroll.table(
  'ticket_message',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    ticketId: uuid('ticket_id').notNull(),
    authorRole: text('author_role').notNull(),
    body: text('body').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    daysAgo: integer('days_ago'),
    minuteOfDay: integer('minute_of_day'),
    createdAt: createdAt(),
  },
  (t) => [
    index('ticket_message_tenant_idx').on(t.tenantId),
    index('ticket_message_ticket_idx').on(t.tenantId, t.ticketId),
    foreignKey({
      name: 'ticket_message_ticket_fk',
      columns: [t.tenantId, t.ticketId],
      foreignColumns: [repairTicket.tenantId, repairTicket.id],
    }),
    check(
      'ticket_message_author_valid',
      sql`${t.authorRole} in ('owner', 'caretaker', 'tenant')`,
    ),
  ],
);

export const announcement = rentroll.table(
  'announcement',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    buildingId: uuid('building_id').notNull(),
    titleTh: text('title_th').notNull(),
    titleEn: text('title_en').notNull(),
    bodyTh: text('body_th').notNull(),
    bodyEn: text('body_en').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    daysAgo: integer('days_ago'),
    minuteOfDay: integer('minute_of_day'),
    createdAt: createdAt(),
  },
  (t) => [
    index('announcement_tenant_idx').on(t.tenantId),
    foreignKey({
      name: 'announcement_building_fk',
      columns: [t.tenantId, t.buildingId],
      foreignColumns: [building.tenantId, building.id],
    }),
  ],
);

/** Gap-free document numbers per building, doc type and year (01 §4). Locked with SELECT … FOR UPDATE. */
export const docSequence = rentroll.table(
  'doc_sequence',
  {
    tenantId: uuid('tenant_id').notNull(),
    buildingId: uuid('building_id').notNull(),
    docType: text('doc_type').notNull(),
    year: smallint('year').notNull(),
    nextNo: integer('next_no').notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.buildingId, t.docType, t.year] }),
    index('doc_sequence_tenant_idx').on(t.tenantId),
    foreignKey({
      name: 'doc_sequence_building_fk',
      columns: [t.tenantId, t.buildingId],
      foreignColumns: [building.tenantId, building.id],
    }),
  ],
);
