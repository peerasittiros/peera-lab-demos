import { ActionError, withTenant, type Tx } from '@peera/db';
import { and, eq } from 'drizzle-orm';
import { loadBillingPlan, type BillingPlan, type BillingRoom } from '../queries/billing';
import { monthlyInvoice, type BillLine } from '../../domain/billing';
import { addMonths } from '../../domain/dates';
import { formatDocumentNumber, type YearStyle } from '../../domain/numbering';
import type { LateFeeRule } from '../../domain/late-fee';
import type { ElectricityRate, WaterRate } from '../../domain/utilities';
import { invoice, invoiceLine } from '../schema';
import { nextDocumentNumber } from './contracts';

type RatePlanRow = NonNullable<BillingPlan['plan']>;

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

function labelOf(line: BillLine): { th: string; en: string } {
  if (line.kind === 'extra') return LABELS[String(line.meta.item)] ?? { th: 'รายการอื่น', en: 'Other' };
  return LABELS[line.kind] ?? { th: line.kind, en: line.kind };
}

/** Maps a rate plan row to the domain's rate shapes. */
function ratesOf(plan: RatePlanRow): {
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
        : { mode: 'per_unit', ratePerUnit: plan.waterRateSatang, minCharge: plan.waterMinSatang },
    commonFee: plan.commonFeeSatang,
    lateFee: { mode: plan.lateFeeRule.kind, amount: plan.lateFeeRule.amountSatang, cap: plan.lateFeeRule.capSatang },
  };
}

/** Meters a room still needs before its invoice can be billed. */
export function missingReadings(room: BillingRoom): { electricity: boolean; water: boolean } {
  return { electricity: room.electricity?.current == null, water: room.water?.current == null };
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
    if (row && row.current != null) return { units: row.currentUnits ?? 0, estimate: false };
    if (estimate) return { units: Math.round(row?.averageUnits ?? 0), estimate: true };
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
    plan: { elec: rates.elec, water: rates.water, commonFee: rates.commonFee, lateFee: rates.lateFee },
    electricity,
    water,
    previousBalance: room.previousBalance,
    repairCharges: room.repairCharges,
    overdue: room.overdue,
    asOf,
  });
}

/** The preview for every room: what would be billed, and what is still missing. Read-only. */
export function previewBilling(plan: BillingPlan, estimateRoomIds: string[], asOf: Date, period: string) {
  const estimates = new Set(estimateRoomIds);
  return plan.rooms
    .filter((r) => !r.existingInvoiceId)
    .map((room) => {
      const missing = missingReadings(room);
      const estimate = {
        electricity: missing.electricity && estimates.has(room.roomId),
        water: missing.water && estimates.has(room.roomId),
      };
      const computed = plan.plan ? planRoom(room, plan.plan, period, estimate, asOf) : null;
      return {
        roomId: room.roomId,
        roomNumber: room.roomNumber,
        renterName: room.renterName,
        missing,
        blocked: (missing.electricity && !estimate.electricity) || (missing.water && !estimate.water),
        total: computed?.total ?? null,
        lines: computed?.lines.map((l) => ({ kind: l.kind, amount: l.amount, meta: l.meta, key: l.key })) ?? [],
      };
    });
}

/**
 * Generates the month's draft invoices (01 §3.1 C.9). Refused while any room still lacks a reading, unless the
 * owner estimated it. Numbers come from `doc_sequence` inside this transaction, so they have no gaps; a month that
 * already has an invoice for a contract is skipped, so running it twice creates nothing new.
 */
export async function generateBilling(
  tx: Tx,
  tenantId: string,
  input: { buildingId: string; period: string; estimateRoomIds: string[]; asOf: Date; today: string },
) {
  const plan = await loadBillingPlan(tx, tenantId, { buildingId: input.buildingId, period: input.period, today: input.today });
  if (!plan) throw new ActionError('building.not_found', 'property.errors.notFound');
  if (!plan.plan) throw new ActionError('rate_plan.missing', 'billing.errors.noRatePlan');
  const estimates = new Set(input.estimateRoomIds);
  const pending = plan.rooms.filter((r) => !r.existingInvoiceId);
  const blocked = pending.some((room) => {
    const missing = missingReadings(room);
    return (missing.electricity || missing.water) && !estimates.has(room.roomId);
  });
  if (blocked) throw new ActionError('billing.missing_readings', 'billing.errors.missingReadings');

  const scope = withTenant(tx, tenantId);
  const year = Number(input.period.slice(0, 4));
  const month = Number(input.period.slice(5, 7));
  const style = plan.building.invoiceYearStyle as YearStyle;
  const issue = `${input.period}-${String(plan.building.billingDay).padStart(2, '0')}`;
  const due = `${addMonths(input.period, 1)}-${String(plan.building.dueDay).padStart(2, '0')}`;
  const numbers: string[] = [];

  for (const room of pending) {
    const estimate = {
      electricity: missingReadings(room).electricity && estimates.has(room.roomId),
      water: missingReadings(room).water && estimates.has(room.roomId),
    };
    const computed = planRoom(room, plan.plan, input.period, estimate, input.asOf);
    if (!computed) continue;
    const sequence = await nextDocumentNumber(tx, tenantId, input.buildingId, 'INV', year);
    const number = formatDocumentNumber({ prefix: 'INV', ceYear: year, month, sequence, style });
    const [created] = await scope
      .insert(invoice, [
        {
          buildingId: input.buildingId,
          contractId: room.contractId,
          number,
          type: 'monthly',
          period: input.period,
          issueDate: issue,
          dueDate: due,
          status: 'draft',
          subtotalSatang: computed.subtotal,
          totalSatang: computed.total,
          paidSatang: 0,
          sentAt: null,
          publicToken: crypto.randomUUID(),
        },
      ])
      .returning({ id: invoice.id });
    await scope.insert(
      invoiceLine,
      computed.lines.map((line) => {
        const label = labelOf(line);
        return {
          invoiceId: created!.id,
          kind: line.kind,
          labelTh: label.th,
          labelEn: label.en,
          qty: 1,
          unitPriceSatang: line.amount,
          amountSatang: line.amount,
          meta: line.meta,
        };
      }),
    );
    numbers.push(number);
  }
  return { created: numbers.length, numbers };
}

/** Sends the month's drafts (01 §3.1 C.9 "Send all"). They become immutable from here on (migration 0002). */
export async function sendBilling(tx: Tx, tenantId: string, input: { buildingId: string; period: string; sentAt: Date }) {
  const scope = withTenant(tx, tenantId);
  const rows = await scope
    .update(
      invoice,
      { status: 'sent', sentAt: input.sentAt },
      and(
        eq(invoice.buildingId, input.buildingId),
        eq(invoice.period, input.period),
        eq(invoice.type, 'monthly'),
        eq(invoice.status, 'draft'),
      ),
    )
    .returning({ id: invoice.id });
  return { sent: rows.length };
}

/** Voids a draft. Its number stays used, so the sequence keeps no gaps. A sent invoice cannot be voided (01 §4). */
export async function voidDraft(tx: Tx, tenantId: string, invoiceId: string) {
  const scope = withTenant(tx, tenantId);
  const [found] = await scope.select(invoice, eq(invoice.id, invoiceId));
  if (!found) throw new ActionError('invoice.not_found', 'billing.errors.notFound');
  if (found.status !== 'draft') throw new ActionError('invoice.not_draft', 'billing.errors.notDraft');
  await scope.update(invoice, { status: 'void' }, eq(invoice.id, invoiceId));
  return { invoiceId, number: found.number };
}
