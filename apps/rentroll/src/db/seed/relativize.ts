import { addMonths, dayNumber, isoFromDayNumber } from '../../domain/dates';
import type { SnapshotKey, SnapshotName } from '../snapshot-tables';

/**
 * Turns the template's relative dates into real ones for a given day. This is a TypeScript port of
 * `rentroll.clone_demo_tenant` and `rentroll.period_for` (migrations/0001_clone_demo_tenant.sql), so the browser
 * snapshot matches what a clone would have produced. Rules, in SQL terms:
 *   - period `~mNN` → the month NN months before `today`; any other period stays as it is.
 *   - `*_days_ago` set → the date is `today - days_ago`; the field is kept as it was when null.
 *   - Timestamps built from `days_ago` are at a fixed Bangkok time of day: meter reads 09:00, invoice sent 09:00,
 *     repair scheduled 10:00, announcement 08:00. Payments and ticket messages use `minute_of_day` (default 10:00).
 *   - An invoice's due date keeps its template gap from the issue date.
 */

export type SnapshotRow = Record<string, unknown>;
export type SnapshotTables = Partial<Record<SnapshotName, SnapshotRow[]>>;
export type SeedRows = Partial<Record<SnapshotKey, SnapshotRow[]>>;

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** The instant at `minuteOfDay` Bangkok time on the Bangkok calendar day `isoDate`. */
export function bangkokInstant(isoDate: string, minuteOfDay: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const midnightUtc = Date.UTC(year!, month! - 1, day!);
  return new Date(
    midnightUtc + minuteOfDay * MINUTE_MS - BANGKOK_OFFSET_MS,
  ).toISOString();
}

/** `today` moved back by `daysAgo` days (negative goes forward). */
export function daysAgoDate(today: string, daysAgo: number): string {
  return isoFromDayNumber(dayNumber(today) - daysAgo);
}

/** `rentroll.period_for`: `~mNN` is NN months before the month of `today`. */
export function periodFor(
  templatePeriod: string | null,
  today: string,
): string | null {
  if (templatePeriod === null) return null;
  const trimmed = templatePeriod.trim();
  if (!trimmed.startsWith('~m')) return templatePeriod;
  return addMonths(today.slice(0, 7), -Number(trimmed.slice(2)));
}

function num(row: SnapshotRow, field: string): number | null {
  const value = row[field];
  return typeof value === 'number' ? value : null;
}

function str(row: SnapshotRow, field: string): string | null {
  const value = row[field];
  return typeof value === 'string' ? value : null;
}

/** Drizzle returns Date objects for timestamps; the document carries ISO strings. */
function jsonSafe(row: SnapshotRow): SnapshotRow {
  const out: SnapshotRow = {};
  for (const [field, value] of Object.entries(row)) {
    if (value === undefined) continue;
    out[field] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

/** Fields that only exist to drive the relative dates; the client never needs them. */
const RELATIVE_ONLY = [
  'tenantId',
  'daysAgo',
  'startDaysAgo',
  'endDaysAgo',
  'noticeDaysAgo',
  'minuteOfDay',
] as const;

function withoutRelative(row: SnapshotRow): SnapshotRow {
  const copy = { ...row };
  for (const field of RELATIVE_ONLY) delete copy[field];
  return copy;
}

function relativizeRow(
  key: SnapshotKey,
  row: SnapshotRow,
  today: string,
): SnapshotRow {
  const out = withoutRelative(row);
  const daysAgo = num(row, 'daysAgo');
  const minute = num(row, 'minuteOfDay');
  const dayOf = (ago: number) => daysAgoDate(today, ago);

  switch (key) {
    case 'contracts': {
      const start = num(row, 'startDaysAgo');
      const end = num(row, 'endDaysAgo');
      const notice = num(row, 'noticeDaysAgo');
      if (start !== null) out.startDate = dayOf(start);
      if (end !== null) out.endDate = dayOf(end);
      if (notice !== null) out.noticeDate = dayOf(notice);
      return out;
    }
    case 'meterReadings': {
      out.period = periodFor(str(row, 'period'), today);
      if (daysAgo !== null) out.readAt = bangkokInstant(dayOf(daysAgo), 9 * 60);
      return out;
    }
    case 'invoices': {
      out.period = periodFor(str(row, 'period'), today);
      if (daysAgo !== null) {
        const issue = dayOf(daysAgo);
        const gap =
          dayNumber(str(row, 'dueDate')!) - dayNumber(str(row, 'issueDate')!);
        out.issueDate = issue;
        out.dueDate = isoFromDayNumber(dayNumber(issue) + gap);
        out.sentAt = bangkokInstant(issue, 9 * 60);
      }
      return out;
    }
    case 'payments': {
      if (daysAgo !== null)
        out.paidAt = bangkokInstant(dayOf(daysAgo), minute ?? 10 * 60);
      return out;
    }
    case 'repairTickets': {
      if (daysAgo !== null)
        out.scheduledAt = bangkokInstant(dayOf(daysAgo), 10 * 60);
      return out;
    }
    case 'ticketMessages': {
      if (daysAgo !== null)
        out.at = bangkokInstant(dayOf(daysAgo), minute ?? 10 * 60);
      return out;
    }
    case 'announcements': {
      if (daysAgo !== null)
        out.publishedAt = bangkokInstant(dayOf(daysAgo), 8 * 60);
      return out;
    }
    case 'invoiceLines':
      // The seed's lines carry no meta object; the database defaults it to {}, so the snapshot does too.
      out.meta ??= {};
      return out;
    default:
      return out;
  }
}

/** Relative template rows in, a snapshot document's tables out (dates resolved for `today`, Date values as strings). */
export function relativizeSeed(seed: SeedRows, today: string): SnapshotTables {
  const tables: Partial<Record<SnapshotName, SnapshotRow[]>> = {};
  for (const [key, rows] of Object.entries(seed) as [
    SnapshotKey,
    SnapshotRow[] | undefined,
  ][]) {
    if (!Array.isArray(rows)) continue;
    const name = SNAPSHOT_NAME_BY_KEY[key];
    tables[name] = rows.map((row) => jsonSafe(relativizeRow(key, row, today)));
  }
  return tables;
}

const SNAPSHOT_NAME_BY_KEY: Record<SnapshotKey, SnapshotName> = {
  buildings: 'building',
  ratePlans: 'rate_plan',
  roomTypes: 'room_type',
  rooms: 'room',
  renters: 'renter',
  contracts: 'contract',
  contractRenters: 'contract_renter',
  meterReadings: 'meter_reading',
  invoices: 'invoice',
  invoiceLines: 'invoice_line',
  payments: 'payment',
  paymentAllocations: 'payment_allocation',
  creditNotes: 'credit_note',
  checklists: 'checklist',
  settlements: 'settlement',
  repairTickets: 'repair_ticket',
  ticketMessages: 'ticket_message',
  announcements: 'announcement',
  docSequences: 'doc_sequence',
};
