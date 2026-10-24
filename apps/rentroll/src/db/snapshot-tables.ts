import {
  announcement,
  building,
  checklist,
  contract,
  contractRenter,
  creditNote,
  docSequence,
  invoice,
  invoiceLine,
  meterReading,
  payment,
  paymentAllocation,
  ratePlan,
  renter,
  repairTicket,
  room,
  roomType,
  settlement,
  ticketMessage,
} from './schema';

/**
 * The tables in the daily snapshot (SPEC §2.1). `key` is the name the seed generator uses (`SeedData`), `name` is the
 * Postgres table, which is also the key in the snapshot document.
 */
export const SNAPSHOT_TABLES = [
  { key: 'buildings', name: 'building', table: building },
  { key: 'ratePlans', name: 'rate_plan', table: ratePlan },
  { key: 'roomTypes', name: 'room_type', table: roomType },
  { key: 'rooms', name: 'room', table: room },
  { key: 'renters', name: 'renter', table: renter },
  { key: 'contracts', name: 'contract', table: contract },
  { key: 'contractRenters', name: 'contract_renter', table: contractRenter },
  { key: 'meterReadings', name: 'meter_reading', table: meterReading },
  { key: 'invoices', name: 'invoice', table: invoice },
  { key: 'invoiceLines', name: 'invoice_line', table: invoiceLine },
  { key: 'payments', name: 'payment', table: payment },
  {
    key: 'paymentAllocations',
    name: 'payment_allocation',
    table: paymentAllocation,
  },
  { key: 'creditNotes', name: 'credit_note', table: creditNote },
  { key: 'checklists', name: 'checklist', table: checklist },
  { key: 'settlements', name: 'settlement', table: settlement },
  { key: 'repairTickets', name: 'repair_ticket', table: repairTicket },
  { key: 'ticketMessages', name: 'ticket_message', table: ticketMessage },
  { key: 'announcements', name: 'announcement', table: announcement },
  { key: 'docSequences', name: 'doc_sequence', table: docSequence },
] as const;

export type SnapshotKey = (typeof SNAPSHOT_TABLES)[number]['key'];
export type SnapshotName = (typeof SNAPSHOT_TABLES)[number]['name'];
