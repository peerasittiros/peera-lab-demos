import { bangkokDate, dayNumber } from './dates';
import { assertSatang, type Satang } from './money';

/**
 * Per building (`rate_plan.late_fee_rule`). `per_day` charges `amount` for every day late; `once` charges `amount`
 * one time. Both stop at `cap`.
 */
export type LateFeeRule = {
  mode: 'per_day' | 'once';
  amount: Satang;
  cap: Satang;
};

/**
 * Whole Bangkok days after the due date. The due day runs to 23:59:59 Bangkok time, so any time on the next
 * Bangkok calendar day counts as day 1.
 */
export function daysLate(dueDate: string, asOf: Date): number {
  return Math.max(0, dayNumber(bangkokDate(asOf)) - dayNumber(dueDate));
}

export function lateFee(rule: LateFeeRule, dueDate: string, asOf: Date): Satang {
  const days = daysLate(dueDate, asOf);
  if (days === 0) return 0;
  const raw = rule.mode === 'per_day' ? rule.amount * days : rule.amount;
  return assertSatang(Math.min(raw, rule.cap), 'late fee');
}
