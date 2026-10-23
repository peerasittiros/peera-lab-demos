import { assertSatang, type Satang } from './money';

export type SettlementInput = {
  deposit: Satang;
  unpaid: Satang;
  finalUtilities: Satang;
  damages: Satang;
  cleaningFee: Satang;
};

export type Deduction = { kind: 'unpaid' | 'final_utilities' | 'damages' | 'cleaning'; amount: Satang };

/**
 * Deposit settlement (01 §4): refund = deposit − unpaid − final utilities − damages − cleaning. A negative refund
 * means the tenant still owes that amount.
 */
export function settleDeposit(input: SettlementInput): { deductions: Deduction[]; refund: Satang } {
  const deductions: Deduction[] = [
    { kind: 'unpaid', amount: assertSatang(input.unpaid, 'unpaid') },
    { kind: 'final_utilities', amount: assertSatang(input.finalUtilities, 'final utilities') },
    { kind: 'damages', amount: assertSatang(input.damages, 'damages') },
    { kind: 'cleaning', amount: assertSatang(input.cleaningFee, 'cleaning fee') },
  ];
  for (const d of deductions) {
    if (d.amount < 0) throw new RangeError(`${d.kind} must not be negative`);
  }
  const deducted = deductions.reduce((sum, d) => sum + d.amount, 0);
  return { deductions, refund: assertSatang(assertSatang(input.deposit, 'deposit') - deducted, 'refund') };
}
