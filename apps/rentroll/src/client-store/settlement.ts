import { bangkokDate } from '@/src/domain/dates';
import { formatDocumentNumber, type YearStyle } from '@/src/domain/numbering';
import { allocatePayment } from '@/src/domain/payments';
import type { Data } from './schema';

/**
 * How money settles on a contract (SPEC §2.2, 01 §4): the oldest open invoice first, and a receipt numbered from the
 * building's `RCT` sequence for the Bangkok year. Commands use these to work out an op's results; the reducers only
 * store them.
 */

export const RECEIPT_TYPE = 'RCT';
const OPEN_STATUSES = ['sent', 'partially_paid'];

export type Allocation = { invoiceId: string; amount: number };

/** The contract's invoices that still owe money, oldest due date first. */
export function openInvoices(data: Data, contractId: string) {
  return data.invoice
    .filter(
      (i) => i.contractId === contractId && OPEN_STATUSES.includes(i.status),
    )
    .map((i) => ({
      id: i.id,
      dueDate: i.dueDate,
      outstanding: i.totalSatang - i.paidSatang,
      total: i.totalSatang,
      paid: i.paidSatang,
    }));
}

export function owedOn(data: Data, contractId: string): number {
  return openInvoices(data, contractId).reduce(
    (sum, i) => sum + i.outstanding,
    0,
  );
}

/** Splits `amount` over the contract's open invoices. Null when the amount is more than the balance. */
export function allocationFor(
  data: Data,
  contractId: string,
  amount: number,
): Allocation[] | null {
  if (amount > owedOn(data, contractId)) return null;
  return allocatePayment(
    amount,
    openInvoices(data, contractId).map(({ id, dueDate, outstanding }) => ({
      id,
      dueDate,
      outstanding,
    })),
  ).allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount }));
}

export type ReceiptNumber = {
  buildingId: string;
  docType: string;
  year: number;
  sequence: number;
  receiptNumber: string;
};

/** The next receipt for the contract's building, in the Bangkok year of `now`. Null if the room chain is broken. */
export function receiptFor(
  data: Data,
  contractId: string,
  now: Date,
): ReceiptNumber | null {
  const contract = data.contract.find((c) => c.id === contractId);
  const room = contract && data.room.find((r) => r.id === contract.roomId);
  const building = room && data.building.find((b) => b.id === room.buildingId);
  if (!building) return null;
  const [year, month] = bangkokDate(now).split('-').map(Number);
  const sequence =
    data.doc_sequence.find(
      (s) =>
        s.buildingId === building.id &&
        s.docType === RECEIPT_TYPE &&
        s.year === year,
    )?.nextNo ?? 1;
  return {
    buildingId: building.id,
    docType: RECEIPT_TYPE,
    year: year!,
    sequence,
    receiptNumber: formatDocumentNumber({
      prefix: RECEIPT_TYPE,
      ceYear: year!,
      month: month!,
      sequence,
      style: building.invoiceYearStyle as YearStyle,
    }),
  };
}
