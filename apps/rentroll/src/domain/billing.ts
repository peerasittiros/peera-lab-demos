import { invoiceTotals, type InvoiceLine } from './invoice';
import { lateFee, type LateFeeRule } from './late-fee';
import { daysInPeriod } from './dates';
import { assertSatang, type Satang } from './money';
import { daysOccupiedInPeriod, prorateRent } from './proration';
import type { ElectricityRate, WaterRate } from './utilities';
import { electricityAmount, waterAmount } from './utilities';

export type BillLine = InvoiceLine & {
  key: string;
  meta: Record<string, unknown>;
};

export type MonthlyInput = {
  period: string;
  contract: {
    startDate: string;
    endDate: string | null;
    monthlyRent: Satang;
    occupants: number;
    parking: Satang;
    internet: Satang;
  };
  plan: {
    elec: ElectricityRate;
    water: WaterRate;
    commonFee: Satang;
    lateFee: LateFeeRule;
  };
  /** Units for the period. `estimate` marks a reading the owner chose to estimate (01 §3.1 C.9). */
  electricity: { units: number; estimate: boolean };
  water: { units: number; estimate: boolean };
  /** Sent invoices still owed by the contract, before this period. */
  previousBalance: Satang;
  /** Repairs the owner billed to this renter that are done and not yet on an invoice (01 §3.1 E.17). */
  repairCharges: { ticketId: string; amount: Satang }[];
  /** Invoices past their due date with money still owed, and whether a late fee was already charged on each. */
  overdue: {
    id: string;
    dueDate: string;
    outstanding: Satang;
    alreadyCharged: boolean;
  }[];
  asOf: Date;
};

/**
 * The lines of one monthly invoice (01 §4). Returns null when the contract does not cover any day of the period.
 * Rent is prorated for a start or end inside the month. Late fees are charged once per overdue invoice.
 */
export function monthlyInvoice(
  input: MonthlyInput,
): { lines: BillLine[]; subtotal: Satang; total: Satang } | null {
  const days = daysOccupiedInPeriod(
    input.period,
    input.contract.startDate,
    input.contract.endDate,
  );
  if (days === 0) return null;
  const rent =
    days >= daysInPeriod(input.period)
      ? input.contract.monthlyRent
      : prorateRent({
          monthlyRent: input.contract.monthlyRent,
          period: input.period,
          daysOccupied: days,
          mode: 'prorate',
        });

  const lines: BillLine[] = [
    { key: 'rent', kind: 'rent', amount: rent, meta: { days } },
    {
      key: 'electricity',
      kind: 'electricity',
      amount: electricityAmount(input.electricity.units, input.plan.elec),
      meta: {
        units: input.electricity.units,
        estimate: input.electricity.estimate,
      },
    },
    {
      key: 'water',
      kind: 'water',
      amount: waterAmount(
        input.water.units,
        input.contract.occupants,
        input.plan.water,
      ),
      meta: { units: input.water.units, estimate: input.water.estimate },
    },
    {
      key: 'common',
      kind: 'extra',
      amount: input.plan.commonFee,
      meta: { item: 'common' },
    },
  ];
  if (input.contract.parking > 0) {
    lines.push({
      key: 'parking',
      kind: 'extra',
      amount: input.contract.parking,
      meta: { item: 'parking' },
    });
  }
  if (input.contract.internet > 0) {
    lines.push({
      key: 'internet',
      kind: 'extra',
      amount: input.contract.internet,
      meta: { item: 'internet' },
    });
  }

  for (const charge of input.repairCharges) {
    lines.push({
      key: `repair-${charge.ticketId}`,
      kind: 'one_off',
      amount: charge.amount,
      meta: { ticketId: charge.ticketId, item: 'repair' },
    });
  }

  for (const invoice of input.overdue) {
    if (invoice.alreadyCharged) continue;
    const fee = lateFee(input.plan.lateFee, invoice.dueDate, input.asOf);
    if (fee > 0)
      lines.push({
        key: `late-${invoice.id}`,
        kind: 'late_fee',
        amount: fee,
        meta: { forInvoice: invoice.id },
      });
  }
  if (input.previousBalance > 0) {
    lines.push({
      key: 'previous',
      kind: 'previous_balance',
      amount: input.previousBalance,
      meta: {},
    });
  }
  const totals = invoiceTotals(
    lines.map((l) => ({ kind: l.kind, amount: assertSatang(l.amount, l.key) })),
  );
  return { lines, ...totals };
}
