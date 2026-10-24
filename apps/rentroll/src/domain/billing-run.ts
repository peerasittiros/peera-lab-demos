import type { InferSelectModel } from 'drizzle-orm';
import type { ratePlan } from '../db/schema';
import { monthlyInvoice, type BillLine } from './billing';
import type { LateFeeRule } from './late-fee';
import type { ElectricityRate, WaterRate } from './utilities';

/**
 * The billing run's pure parts (SPEC §4 O10): what one room would be billed, and which meters are still missing. Used
 * by the store's selectors and commands, and by the server's billing run until R9 retires it.
 */

/** The rate plan's numbers. The tenant and created-at columns are not used here. */
export type RatePlanRow = Omit<
  InferSelectModel<typeof ratePlan>,
  'tenantId' | 'createdAt'
>;

/** A meter's round row: the room's previous and current reading for one meter and period. */
export type MeterRoomRow = {
  roomId: string;
  number: string;
  floor: number;
  sort: number;
  digits: number;
  previous: number | null;
  previousPeriod: string | null;
  current: number | null;
  currentUnits: number | null;
  currentRollover: boolean;
  currentAnomaly: string | null;
  averageUnits: number | null;
};

export type OverdueInvoice = {
  id: string;
  dueDate: string;
  outstanding: number;
  alreadyCharged: boolean;
};

export type BillingRoom = {
  contractId: string;
  roomId: string;
  roomNumber: string;
  renterName: string | null;
  startDate: string;
  endDate: string | null;
  monthlyRent: number;
  occupants: number;
  parking: number;
  internet: number;
  electricity: MeterRoomRow | null;
  water: MeterRoomRow | null;
  previousBalance: number;
  repairCharges: { ticketId: string; amount: number }[];
  overdue: OverdueInvoice[];
  existingInvoiceId: string | null;
};

const LABELS: Record<string, { th: string; en: string }> = {
  rent: { th: 'ค่าเช่า', en: 'Rent' },
  electricity: { th: 'ค่าไฟฟ้า', en: 'Electricity' },
  water: { th: 'ค่าน้ำ', en: 'Water' },
  common: { th: 'ค่าส่วนกลาง', en: 'Common fee' },
  parking: { th: 'ที่จอดรถ', en: 'Parking' },
  internet: { th: 'อินเทอร์เน็ต', en: 'Internet' },
  late_fee: { th: 'ค่าปรับล่าช้า', en: 'Late fee' },
  one_off: { th: 'ค่าซ่อม', en: 'Repair charge' },
  previous_balance: { th: 'ยอดค้างยกมา', en: 'Previous balance' },
};

/** Thai and English labels for an invoice line. */
export function labelOf(line: Pick<BillLine, 'kind' | 'meta'>): {
  th: string;
  en: string;
} {
  if (line.kind === 'extra')
    return LABELS[String(line.meta.item)] ?? { th: 'รายการอื่น', en: 'Other' };
  return LABELS[line.kind] ?? { th: line.kind, en: line.kind };
}

/** Maps a rate plan row to the domain's rate shapes. */
export function ratesOf(plan: RatePlanRow): {
  elec: ElectricityRate;
  water: WaterRate;
  commonFee: number;
  lateFee: LateFeeRule;
} {
  return {
    elec: { ratePerUnit: plan.elecRateSatang, minCharge: plan.elecMinSatang },
    water:
      plan.waterMode === 'per_person'
        ? { mode: 'per_person', perPerson: plan.waterPerPersonSatang }
        : {
            mode: 'per_unit',
            ratePerUnit: plan.waterRateSatang,
            minCharge: plan.waterMinSatang,
          },
    commonFee: plan.commonFeeSatang,
    lateFee: {
      mode: plan.lateFeeRule.kind,
      amount: plan.lateFeeRule.amountSatang,
      cap: plan.lateFeeRule.capSatang,
    },
  };
}

/** Meters a room still needs before its invoice can be billed. */
export function missingReadings(room: BillingRoom): {
  electricity: boolean;
  water: boolean;
} {
  return {
    electricity: room.electricity?.current == null,
    water: room.water?.current == null,
  };
}

/**
 * One room's invoice lines for the month. A missing reading is estimated (the average of the last three months)
 * only when the owner chose to estimate it; the line says so. Returns null when there is nothing to bill.
 */
export function planRoom(
  room: BillingRoom,
  plan: RatePlanRow,
  period: string,
  estimate: { electricity: boolean; water: boolean },
  asOf: Date,
) {
  const rates = ratesOf(plan);
  const meter = (row: BillingRoom['electricity']) => {
    if (row && row.current != null)
      return { units: row.currentUnits ?? 0, estimate: false };
    if (estimate)
      return { units: Math.round(row?.averageUnits ?? 0), estimate: true };
    return null;
  };
  const electricity = meter(room.electricity);
  const water = meter(room.water);
  if (!electricity || !water) return null;
  return monthlyInvoice({
    period,
    contract: {
      startDate: room.startDate,
      endDate: room.endDate,
      monthlyRent: room.monthlyRent,
      occupants: room.occupants,
      parking: room.parking,
      internet: room.internet,
    },
    plan: {
      elec: rates.elec,
      water: rates.water,
      commonFee: rates.commonFee,
      lateFee: rates.lateFee,
    },
    electricity,
    water,
    previousBalance: room.previousBalance,
    repairCharges: room.repairCharges,
    overdue: room.overdue,
    asOf,
  });
}

/** The preview for every room without an invoice this month: what would be billed, and what is still missing. */
export function previewBilling(
  rooms: BillingRoom[],
  plan: RatePlanRow | null,
  estimateRoomIds: string[],
  asOf: Date,
  period: string,
) {
  const estimates = new Set(estimateRoomIds);
  return rooms
    .filter((r) => !r.existingInvoiceId)
    .map((room) => {
      const missing = missingReadings(room);
      const estimate = {
        electricity: missing.electricity && estimates.has(room.roomId),
        water: missing.water && estimates.has(room.roomId),
      };
      const computed = plan
        ? planRoom(room, plan, period, estimate, asOf)
        : null;
      return {
        roomId: room.roomId,
        roomNumber: room.roomNumber,
        renterName: room.renterName,
        missing,
        blocked:
          (missing.electricity && !estimate.electricity) ||
          (missing.water && !estimate.water),
        total: computed?.total ?? null,
        lines:
          computed?.lines.map((l) => ({
            kind: l.kind,
            amount: l.amount,
            meta: l.meta,
            key: l.key,
          })) ?? [],
      };
    });
}

export type { BillLine };
