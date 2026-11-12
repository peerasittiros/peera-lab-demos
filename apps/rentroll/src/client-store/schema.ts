import type { InferSelectModel, Table } from 'drizzle-orm';
import type * as s from '@/src/db/schema';

/**
 * Row types for the browser store (SPEC §2.2). They are the server's select types minus `tenantId`, with timestamps as
 * ISO strings, because the snapshot is JSON. Derived from the schema, so a column change shows up here at once.
 */
type Json<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
      ? string | null
      : T[K];
};
/** Fields that only drive the template's relative dates (see db/seed/relativize.ts); the snapshot drops them. */
type RelativeOnly =
  | 'tenantId'
  | 'daysAgo'
  | 'startDaysAgo'
  | 'endDaysAgo'
  | 'noticeDaysAgo'
  | 'minuteOfDay';
type Stored<T extends Table> = Json<Omit<InferSelectModel<T>, RelativeOnly>>;

/**
 * Settings the visitor changes in this browser: the logo, the phone, the invoice note, the display names, and the floor
 * and room-type order. They are not in the snapshot (the demo never writes to the server), so this table starts empty
 * and the visitor's ops carry it (ux-v2/rentroll.md › Settings).
 */
export type SettingRow = { id: string; value: string; createdAt: string };

export type Tables = {
  setting: SettingRow;
  building: Stored<typeof s.building>;
  rate_plan: Stored<typeof s.ratePlan>;
  room_type: Stored<typeof s.roomType>;
  room: Stored<typeof s.room>;
  renter: Stored<typeof s.renter>;
  contract: Stored<typeof s.contract>;
  contract_renter: Stored<typeof s.contractRenter>;
  meter_reading: Stored<typeof s.meterReading>;
  invoice: Stored<typeof s.invoice>;
  invoice_line: Stored<typeof s.invoiceLine>;
  payment: Stored<typeof s.payment>;
  payment_allocation: Stored<typeof s.paymentAllocation>;
  credit_note: Stored<typeof s.creditNote>;
  checklist: Stored<typeof s.checklist>;
  settlement: Stored<typeof s.settlement>;
  repair_ticket: Stored<typeof s.repairTicket>;
  ticket_message: Stored<typeof s.ticketMessage>;
  announcement: Stored<typeof s.announcement>;
  doc_sequence: Stored<typeof s.docSequence>;
};

export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T];

/** Every table, as arrays of rows: the store's in-memory data. */
export type Data = { [K in TableName]: Tables[K][] };

/** The snapshot document from `GET /api/demo/snapshot`. */
export type Snapshot = {
  schemaVersion: 1;
  snapshotDate: string;
  tables: Partial<{ [K in TableName]: Tables[K][] }>;
};

export const SCHEMA_VERSION = 1;

export type Role = 'owner' | 'caretaker' | 'tenant';
