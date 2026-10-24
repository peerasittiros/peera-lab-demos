import { assertSatang, type Satang } from './money';

export type InvoiceLineKind =
  | 'rent'
  | 'electricity'
  | 'water'
  | 'extra'
  | 'one_off'
  | 'late_fee'
  | 'deposit'
  | 'advance'
  | 'previous_balance'
  | 'credit';

/** Lines of kind `credit` carry a negative amount. Every other kind is zero or positive. */
export type InvoiceLine = { kind: InvoiceLineKind; amount: Satang };

const NON_NEGATIVE_KINDS = new Set<InvoiceLineKind>([
  'rent',
  'electricity',
  'water',
  'extra',
  'one_off',
  'late_fee',
  'deposit',
  'advance',
]);

/**
 * `subtotal` is what this period charges. `total` adds the previous balance and subtracts credits:
 * total = subtotal + previous_balance + credit (the credit line is negative).
 */
export function invoiceTotals(lines: InvoiceLine[]): {
  subtotal: Satang;
  total: Satang;
} {
  let subtotal = 0;
  let carried = 0;
  for (const line of lines) {
    assertSatang(line.amount, line.kind);
    if (line.kind === 'credit') {
      if (line.amount > 0)
        throw new RangeError('credit lines must be zero or negative');
      carried += line.amount;
    } else if (line.kind === 'previous_balance') {
      if (line.amount < 0)
        throw new RangeError(
          'previous balance must not be negative: use a credit line',
        );
      carried += line.amount;
    } else {
      if (!NON_NEGATIVE_KINDS.has(line.kind) || line.amount < 0) {
        throw new RangeError(`${line.kind} lines must not be negative`);
      }
      subtotal += line.amount;
    }
  }
  return { subtotal, total: subtotal + carried };
}

/**
 * Applies a contract's credit (an overpayment carried forward) against an amount due. Returns what is still due and
 * the credit left for later.
 */
export function applyCredit(
  credit: Satang,
  amountDue: Satang,
): { applied: Satang; due: Satang; remainingCredit: Satang } {
  const applied = Math.max(0, Math.min(credit, amountDue));
  return {
    applied,
    due: amountDue - applied,
    remainingCredit: credit - applied,
  };
}
