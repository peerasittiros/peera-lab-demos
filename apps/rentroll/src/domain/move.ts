import { daysOccupiedInPeriod, prorateRent } from './proration';
import {
  electricityAmount,
  unitsUsed,
  waterAmount,
  type ElectricityRate,
  type WaterRate,
} from './utilities';
import { invoiceTotals, type InvoiceLine } from './invoice';
import { settleDeposit, type Deduction } from './deposit';
import { assertSatang, type Satang } from './money';

/** The checklist items for move-in and move-out (01 §3.1 B.6). The owner marks each one OK or damaged. */
export const CHECKLIST_KEYS = [
  'walls',
  'floor',
  'door_lock',
  'aircon',
  'furniture',
  'appliances',
] as const;
export type ChecklistStatus = 'ok' | 'damaged' | null;
export type ChecklistItem = {
  key: string;
  labelTh: string;
  labelEn: string;
  status: ChecklistStatus;
};

export const CHECKLIST_LABELS: Record<
  (typeof CHECKLIST_KEYS)[number],
  { th: string; en: string }
> = {
  walls: { th: 'ผนังและสี', en: 'Walls and paint' },
  floor: { th: 'พื้น', en: 'Floor' },
  door_lock: { th: 'ประตูและกุญแจ', en: 'Door and lock' },
  aircon: { th: 'เครื่องปรับอากาศ', en: 'Air-conditioner' },
  furniture: { th: 'เฟอร์นิเจอร์', en: 'Furniture' },
  appliances: { th: 'เครื่องใช้ไฟฟ้า', en: 'Appliances' },
};

/** A checklist with every item unset, ready for the owner to fill in. */
export function blankChecklist(): ChecklistItem[] {
  return CHECKLIST_KEYS.map((key) => ({
    key,
    labelTh: CHECKLIST_LABELS[key].th,
    labelEn: CHECKLIST_LABELS[key].en,
    status: null,
  }));
}

/**
 * The first invoice of a new contract (01 §3.1 B.6): rent prorated for the days occupied in the start month,
 * the deposit, and advance rent. Amounts are integer satang.
 */
export function moveInInvoice({
  monthlyRent,
  startDate,
  period,
  deposit,
  advanceMonths,
}: {
  monthlyRent: Satang;
  startDate: string;
  /** The start month, `YYYY-MM`. */
  period: string;
  deposit: Satang;
  advanceMonths: number;
}): {
  daysOccupied: number;
  lines: InvoiceLine[];
  subtotal: Satang;
  total: Satang;
} {
  const daysOccupied = daysOccupiedInPeriod(period, startDate, null);
  const rent = prorateRent({
    monthlyRent,
    period,
    daysOccupied,
    mode: 'prorate',
  });
  const lines: InvoiceLine[] = [
    { kind: 'rent', amount: rent },
    { kind: 'deposit', amount: assertSatang(deposit, 'deposit') },
    {
      kind: 'advance',
      amount: assertSatang(monthlyRent * advanceMonths, 'advance rent'),
    },
  ];
  return { daysOccupied, lines, ...invoiceTotals(lines) };
}

export type MoveOutInput = {
  elec: {
    previous: number;
    current: number;
    meterDigits: number;
    rollover: boolean;
    rate: ElectricityRate;
  };
  water: {
    previous: number;
    current: number;
    meterDigits: number;
    rollover: boolean;
    rate: WaterRate;
    occupants: number;
  };
  /** Sent invoices still owed, in satang. */
  unpaid: Satang;
  /** Deposit actually received (contract.deposit_received_satang). */
  deposit: Satang;
  damages: Satang;
  cleaningFee: Satang;
};

/**
 * Move-out settlement (01 §4): the final utilities are priced from the readings since the last one, then deducted
 * with the unpaid balance, damages and cleaning from the deposit. A negative refund means the tenant owes.
 */
export function moveOutSettlement(input: MoveOutInput): {
  units: { electricity: number; water: number };
  utilities: { electricity: Satang; water: Satang };
  deductions: Deduction[];
  refund: Satang;
} {
  const units = {
    electricity: unitsUsed({
      previous: input.elec.previous,
      current: input.elec.current,
      meterDigits: input.elec.meterDigits,
      rollover: input.elec.rollover,
    }),
    water: unitsUsed({
      previous: input.water.previous,
      current: input.water.current,
      meterDigits: input.water.meterDigits,
      rollover: input.water.rollover,
    }),
  };
  const utilities = {
    electricity: electricityAmount(units.electricity, input.elec.rate),
    water: waterAmount(units.water, input.water.occupants, input.water.rate),
  };
  const { deductions, refund } = settleDeposit({
    deposit: input.deposit,
    unpaid: input.unpaid,
    finalUtilities: utilities.electricity + utilities.water,
    damages: input.damages,
    cleaningFee: input.cleaningFee,
  });
  return { units, utilities, deductions, refund };
}

/** Items that were OK at move-in and are damaged at move-out: the candidates for a damage charge. */
export function newDamage(
  moveIn: ChecklistItem[],
  moveOut: ChecklistItem[],
): string[] {
  const before = new Map(moveIn.map((item) => [item.key, item.status]));
  return moveOut
    .filter(
      (item) => item.status === 'damaged' && before.get(item.key) !== 'damaged',
    )
    .map((item) => item.key);
}
