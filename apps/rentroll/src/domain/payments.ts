import { assertSatang, type Satang } from './money';

export type OpenInvoice = {
  id: string;
  dueDate: string;
  /** Still unpaid, in satang. */
  outstanding: Satang;
};

export type Allocation = { invoiceId: string; amount: Satang };

/**
 * Oldest unpaid invoice first (by due date, then id for a stable order). A partial payment leaves the last invoice
 * partly open. Any amount left after every open invoice is an overpayment, to become contract credit.
 */
export function allocatePayment(
  amount: Satang,
  invoices: OpenInvoice[],
): { allocations: Allocation[]; overpayment: Satang } {
  assertSatang(amount, 'payment');
  if (amount < 0) throw new RangeError('payment must not be negative');
  let remaining = amount;
  const allocations: Allocation[] = [];
  const ordered = [...invoices].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
  );
  for (const invoice of ordered) {
    if (remaining === 0) break;
    if (invoice.outstanding <= 0) continue;
    const take = Math.min(remaining, invoice.outstanding);
    allocations.push({ invoiceId: invoice.id, amount: take });
    remaining -= take;
  }
  return { allocations, overpayment: remaining };
}
