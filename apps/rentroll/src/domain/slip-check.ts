/**
 * How a slip's amount compares with what the room owes (ux-v2/rentroll.md › Payments): it matches the oldest open bill
 * or the whole balance, or it is short or over the balance by `diff` satang. Shown as icon and word, never colour
 * alone; the owner still decides.
 */
export type SlipCheck =
  | { kind: 'match' }
  | { kind: 'short'; diff: number }
  | { kind: 'over'; diff: number };

export function slipCheck(
  amountSatang: number,
  open: { outstanding: number }[],
): SlipCheck {
  const owed = open.reduce((sum, invoice) => sum + invoice.outstanding, 0);
  if (amountSatang === owed || amountSatang === open[0]?.outstanding)
    return { kind: 'match' };
  return amountSatang < owed
    ? { kind: 'short', diff: owed - amountSatang }
    : { kind: 'over', diff: amountSatang - owed };
}
