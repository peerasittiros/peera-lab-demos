import { z } from 'zod';
import { bangkokDate, dayNumber, isoFromDayNumber } from '@/src/domain/dates';
import { formatDocumentNumber, type YearStyle } from '@/src/domain/numbering';
import { CHECKLIST_LABELS, moveInInvoice } from '@/src/domain/move';
import { roomStatus } from '@/src/domain/property';
import { newId } from '../ids';
import { nextSequence } from '../selectors/billing';
import { moveOutPreview, type MoveOutInput } from '../selectors/property';
import type { ChecklistRecord, LineRecord } from '../ops';
import type { CommandContext, CommandResult } from './payments';

/**
 * Move-in and move-out (SPEC §4 O7, O8). Each is one op: the renter, the contract, the starting or final meters, the
 * checklist, and the first invoice or the settlement. Owner only.
 */

const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});
const isOwner = (ctx: CommandContext) => ctx.role === 'owner';

const LINE_LABELS: Record<string, { th: string; en: string }> = {
  rent: { th: 'ค่าเช่า', en: 'Rent' },
  deposit: { th: 'เงินประกัน', en: 'Deposit' },
  advance: { th: 'ค่าเช่าล่วงหน้า', en: 'Advance rent' },
};

const SETTLEMENT_LABELS: Record<string, { th: string; en: string }> = {
  unpaid: { th: 'ยอดค้างชำระ', en: 'Unpaid balance' },
  final_utilities: { th: 'ค่าน้ำค่าไฟงวดสุดท้าย', en: 'Final utilities' },
  damages: { th: 'ค่าเสียหาย', en: 'Damages' },
  cleaning: { th: 'ค่าทำความสะอาด', en: 'Cleaning' },
};

const checklistInput = z.array(
  z.object({
    key: z.enum([
      'walls',
      'floor',
      'door_lock',
      'aircon',
      'furniture',
      'appliances',
    ]),
    status: z.enum(['ok', 'damaged']).nullable(),
  }),
);

function checklistRecords(
  items: z.infer<typeof checklistInput>,
): ChecklistRecord[] {
  return items.map((item) => ({
    key: item.key,
    labelTh: CHECKLIST_LABELS[item.key].th,
    labelEn: CHECKLIST_LABELS[item.key].en,
    status: item.status,
  }));
}

const moveInInput = z.object({
  roomId: z.uuid(),
  renter: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('new'),
      name: z.string().trim().min(1).max(120),
      phone: z.string().trim().max(40).nullable(),
    }),
    z.object({ mode: z.literal('existing'), renterId: z.uuid() }),
  ]),
  startDate: z.iso.date(),
  monthlyRentSatang: z.number().int().min(0),
  depositSatang: z.number().int().min(0),
  advanceMonths: z.number().int().min(0).max(12),
  occupants: z.number().int().min(1).max(20),
  parkingSatang: z.number().int().min(0),
  internetSatang: z.number().int().min(0),
  elecReading: z.number().int().min(0),
  waterReading: z.number().int().min(0),
  checklist: checklistInput,
});

/** Move-in: the room must be vacant today. Returns the contract and the first invoice's number. */
export function actMoveIn(
  ctx: CommandContext,
  input: z.input<typeof moveInInput>,
): CommandResult<{ contractId: string; invoiceNumber: string; total: number }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const parsed = moveInInput.safeParse(input);
  if (!parsed.success) return fail('property.errors.invalid');
  const p = parsed.data;
  const data = ctx.store.getState().data;
  const room = data.room.find((r) => r.id === p.roomId);
  if (!room) return fail('property.errors.notFound');
  const today = bangkokDate(ctx.now());
  const status = roomStatus({
    maintenance: room.maintenance,
    contracts: data.contract.filter((c) => c.roomId === room.id),
    today,
  });
  if (status !== 'vacant') return fail('contracts.errors.roomNotVacant');
  const building = data.building.find((b) => b.id === room.buildingId);
  if (!building) return fail('property.errors.notFound');
  if (
    p.renter.mode === 'existing' &&
    !data.renter.some(
      (r) => r.id === (p.renter as { renterId: string }).renterId,
    )
  ) {
    return fail('contracts.errors.renterNotFound');
  }
  if (
    p.elecReading >= 10 ** room.elecMeterDigits ||
    p.waterReading >= 10 ** room.waterMeterDigits
  ) {
    return fail('meters.errors.invalid');
  }

  const moveIn = moveInInvoice({
    monthlyRent: p.monthlyRentSatang,
    startDate: p.startDate,
    period: p.startDate.slice(0, 7),
    deposit: p.depositSatang,
    advanceMonths: p.advanceMonths,
  });
  const year = Number(p.startDate.slice(0, 4));
  const month = Number(p.startDate.slice(5, 7));
  const sequence = nextSequence(data, building.id, 'INV', year);
  const number = formatDocumentNumber({
    prefix: 'INV',
    ceYear: year,
    month,
    sequence,
    style: building.invoiceYearStyle as YearStyle,
  });
  const lines: LineRecord[] = moveIn.lines.map((line) => {
    const label = LINE_LABELS[line.kind] ?? { th: line.kind, en: line.kind };
    return {
      id: newId(),
      kind: line.kind,
      labelTh: label.th,
      labelEn: label.en,
      amountSatang: line.amount,
      meta: {},
    };
  });
  const contractId = newId();
  const renterId =
    p.renter.mode === 'new'
      ? newId()
      : (p.renter as { renterId: string }).renterId;
  const period = p.startDate.slice(0, 7);
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'contract.movein',
    payload: {
      contractId,
      roomId: room.id,
      renter: {
        id: renterId,
        isNew: p.renter.mode === 'new',
        name: p.renter.mode === 'new' ? p.renter.name : '',
        phone: p.renter.mode === 'new' ? p.renter.phone : null,
      },
      startDate: p.startDate,
      monthlyRentSatang: p.monthlyRentSatang,
      depositSatang: p.depositSatang,
      advanceMonths: p.advanceMonths,
      occupants: p.occupants,
      extras: { parking: p.parkingSatang, internet: p.internetSatang },
      period,
      readings: {
        electricity: { id: newId(), reading: p.elecReading },
        water: { id: newId(), reading: p.waterReading },
      },
      checklist: checklistRecords(p.checklist),
      invoice: {
        id: newId(),
        number,
        buildingId: building.id,
        docType: 'INV',
        year,
        sequence,
        issueDate: p.startDate,
        dueDate: isoFromDayNumber(dayNumber(p.startDate) + 7),
        subtotalSatang: moveIn.subtotal,
        totalSatang: moveIn.total,
        publicToken: newId(),
        lines,
      },
    },
  });
  // The contract id is fixed inside the op above; the caller reads the new contract from the store.
  return ok
    ? {
        ok: true,
        value: { contractId, invoiceNumber: number, total: moveIn.total },
      }
    : fail('contracts.errors.saveFailed');
}

const moveOutInput = z.object({
  contractId: z.uuid(),
  moveOutDate: z.iso.date(),
  elecReading: z.number().int().min(0),
  waterReading: z.number().int().min(0),
  elecRollover: z.boolean(),
  waterRollover: z.boolean(),
  damages: z.number().int().min(0),
  cleaningFee: z.number().int().min(0),
  checklist: checklistInput,
});

/** Move-out: the settlement is worked out from the readings and the deposit, then committed in one op. */
export function actMoveOut(
  ctx: CommandContext,
  input: z.input<typeof moveOutInput>,
): CommandResult<{ refund: number }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const parsed = moveOutInput.safeParse(input);
  if (!parsed.success) return fail('contracts.errors.meterInvalid');
  const data = ctx.store.getState().data;
  const preview = moveOutPreview(data, parsed.data as MoveOutInput);
  if (!preview) return fail('contracts.errors.noMeter');
  if (preview.contract.status === 'ended')
    return fail('contracts.errors.notActive');
  const period = parsed.data.moveOutDate.slice(0, 7);
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'contract.moveout',
    payload: {
      contractId: preview.contract.id,
      roomId: preview.room.id,
      moveOutDate: parsed.data.moveOutDate,
      readings: {
        electricity: {
          id: newId(),
          reading: parsed.data.elecReading,
          unitsUsed: preview.result.units.electricity,
        },
        water: {
          id: newId(),
          reading: parsed.data.waterReading,
          unitsUsed: preview.result.units.water,
        },
      },
      period,
      checklist: checklistRecords(parsed.data.checklist),
      settlement: {
        id: newId(),
        depositSatang: preview.contract.depositReceivedSatang,
        deductions: preview.result.deductions.map((d) => ({
          key: d.kind,
          labelTh: SETTLEMENT_LABELS[d.kind]?.th ?? d.kind,
          labelEn: SETTLEMENT_LABELS[d.kind]?.en ?? d.kind,
          amountSatang: d.amount,
        })),
        refundSatang: preview.result.refund,
      },
    },
  });
  return ok
    ? { ok: true, value: { refund: preview.result.refund } }
    : fail('contracts.errors.saveFailed');
}
