import { ActionError, withTenant, type Queryable, type Tx } from '@peera/db';
import { and, eq } from 'drizzle-orm';
import { loadMoveOutContext } from '../queries/contracts';
import { bangkokDate, dayNumber, isoFromDayNumber } from '../../domain/dates';
import { roomStatus } from '../../domain/property';
import {
  CHECKLIST_KEYS,
  CHECKLIST_LABELS,
  moveInInvoice,
  moveOutSettlement,
  type ChecklistItem,
} from '../../domain/move';
import { formatDocumentNumber, type YearStyle } from '../../domain/numbering';
import type { Deduction } from '../../domain/deposit';
import {
  building,
  checklist,
  contract,
  contractRenter,
  docSequence,
  invoice,
  invoiceLine,
  meterReading,
  renter,
  room,
  settlement,
} from '../schema';

/** Line labels are stored with the row, so the invoice reads the same in both locales later. */
const LINE_LABELS = {
  rent: { th: 'ค่าเช่า (ตามวันที่เข้าพัก)', en: 'Rent (prorated)' },
  deposit: { th: 'เงินประกัน', en: 'Deposit' },
  advance: { th: 'ค่าเช่าล่วงหน้า', en: 'Advance rent' },
} as const;

const DEDUCTION_LABELS: Record<Deduction['kind'], { th: string; en: string }> = {
  unpaid: { th: 'ยอดค้างชำระ', en: 'Unpaid balance' },
  final_utilities: { th: 'ค่าสาธารณูปโภคงวดสุดท้าย', en: 'Final utilities' },
  damages: { th: 'ค่าเสียหาย', en: 'Damages' },
  cleaning: { th: 'ค่าทำความสะอาด', en: 'Cleaning' },
};

/** Builds a full checklist from the owner's marks; items the owner left unmarked stay null. */
function checklistItems(marks: { key: string; status: 'ok' | 'damaged' | null }[]): ChecklistItem[] {
  const byKey = new Map(marks.map((m) => [m.key, m.status]));
  return CHECKLIST_KEYS.map((key) => ({
    key,
    labelTh: CHECKLIST_LABELS[key].th,
    labelEn: CHECKLIST_LABELS[key].en,
    status: byKey.get(key) ?? null,
  }));
}

/** A running document number per building, type and year. Gap-free inside the caller's transaction. */
export async function nextDocumentNumber(
  tx: Tx,
  tenantId: string,
  buildingId: string,
  docType: string,
  year: number,
): Promise<number> {
  const scope = withTenant(tx, tenantId);
  const key = and(
    eq(docSequence.buildingId, buildingId),
    eq(docSequence.docType, docType),
    eq(docSequence.year, year),
  );
  const [row] = await scope.select(docSequence, key).for('update');
  if (!row) {
    await scope.insert(docSequence, [{ buildingId, docType, year, nextNo: 2 }]);
    return 1;
  }
  await scope.update(docSequence, { nextNo: row.nextNo + 1 }, key);
  return row.nextNo;
}

async function upsertMeterReading(
  tx: Tx,
  tenantId: string,
  input: {
    roomId: string;
    kind: 'electricity' | 'water';
    period: string;
    reading: number;
    unitsUsed: number | null;
    readBy: string;
    readAt: Date;
  },
) {
  const scope = withTenant(tx, tenantId);
  const key = and(
    eq(meterReading.roomId, input.roomId),
    eq(meterReading.kind, input.kind),
    eq(meterReading.period, input.period),
  );
  const [existing] = await scope.select(meterReading, key);
  const values = {
    reading: input.reading,
    unitsUsed: input.unitsUsed,
    readBy: input.readBy,
    readAt: input.readAt,
  };
  if (existing) {
    await scope.update(meterReading, values, key);
  } else {
    await scope.insert(meterReading, [{ roomId: input.roomId, kind: input.kind, period: input.period, ...values }]);
  }
}

function startOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T09:00:00+07:00`);
}

export async function saveRenter(
  tx: Tx,
  tenantId: string,
  input: {
    id?: string;
    name: string;
    phone: string | null;
    emergencyContact: { name: string; phone: string } | null;
    note: string | null;
  },
) {
  const { id, ...values } = input;
  const scope = withTenant(tx, tenantId);
  if (id) {
    const [row] = await scope.update(renter, values, eq(renter.id, id)).returning({ id: renter.id });
    if (!row) throw new ActionError('renter.not_found', 'contracts.errors.renterNotFound');
    return { id };
  }
  const [row] = await scope.insert(renter, [values]).returning({ id: renter.id });
  return { id: row!.id };
}

export type MoveInInput = {
  roomId: string;
  renter: { mode: 'new'; name: string; phone: string | null; emergencyContact: { name: string; phone: string } | null } | { mode: 'existing'; renterId: string };
  startDate: string;
  monthlyRentSatang: number;
  depositSatang: number;
  advanceMonths: number;
  occupants: number;
  parkingSatang: number;
  internetSatang: number;
  elecReading: number;
  waterReading: number;
  checklist: { key: string; status: 'ok' | 'damaged' | null }[];
  note: string | null;
};

/**
 * Move-in in one transaction (01 §3.1 B.6): renter, contract, starting meters, move-in checklist, and the first
 * invoice (prorated rent, deposit, advance rent). The room must be vacant today.
 */
export async function moveIn(tx: Tx, tenantId: string, input: MoveInInput) {
  const scope = withTenant(tx, tenantId);
  const today = bangkokDate(new Date());
  const [roomRow] = await scope.select(room, eq(room.id, input.roomId));
  if (!roomRow) throw new ActionError('room.not_found', 'property.errors.notFound');
  const roomContracts = await scope.select(contract, eq(contract.roomId, roomRow.id));
  if (roomStatus({ maintenance: roomRow.maintenance, contracts: roomContracts, today }) !== 'vacant') {
    throw new ActionError('contract.room_not_vacant', 'contracts.errors.roomNotVacant');
  }
  const [buildingRow] = await scope.select(building, eq(building.id, roomRow.buildingId));

  let renterId: string;
  if (input.renter.mode === 'new') {
    const created = await saveRenter(tx, tenantId, {
      name: input.renter.name,
      phone: input.renter.phone,
      emergencyContact: input.renter.emergencyContact,
      note: null,
    });
    renterId = created.id;
  } else {
    const [existing] = await scope.select(renter, eq(renter.id, input.renter.renterId));
    if (!existing) throw new ActionError('renter.not_found', 'contracts.errors.renterNotFound');
    renterId = existing.id;
  }

  let contractId: string;
  try {
    const [created] = await scope
      .insert(contract, [
        {
          roomId: roomRow.id,
          startDate: input.startDate,
          endDate: null,
          noticeDate: null,
          status: 'active',
          monthlyRentSatang: input.monthlyRentSatang,
          depositSatang: input.depositSatang,
          // The deposit is taken at move-in; settlement works from what was received.
          depositReceivedSatang: input.depositSatang,
          advanceMonths: input.advanceMonths,
          occupants: input.occupants,
          extras: { parking: input.parkingSatang, internet: input.internetSatang },
          note: input.note,
        },
      ])
      .returning({ id: contract.id });
    contractId = created!.id;
  } catch (error) {
    // The partial unique index allows one live contract per room.
    if (String((error as { code?: unknown }).code ?? (error as { cause?: { code?: unknown } }).cause?.code) === '23505') {
      throw new ActionError('contract.room_not_vacant', 'contracts.errors.roomNotVacant');
    }
    throw error;
  }

  await scope.insert(contractRenter, [{ contractId, renterId, isPrimary: true }]);

  const period = input.startDate.slice(0, 7);
  const readAt = startOfDay(input.startDate);
  await upsertMeterReading(tx, tenantId, {
    roomId: roomRow.id,
    kind: 'electricity',
    period,
    reading: input.elecReading,
    unitsUsed: null,
    readBy: 'move-in',
    readAt,
  });
  await upsertMeterReading(tx, tenantId, {
    roomId: roomRow.id,
    kind: 'water',
    period,
    reading: input.waterReading,
    unitsUsed: null,
    readBy: 'move-in',
    readAt,
  });

  await scope.insert(checklist, [
    { contractId, kind: 'move_in', items: checklistItems(input.checklist), completedAt: new Date() },
  ]);

  const first = moveInInvoice({
    monthlyRent: input.monthlyRentSatang,
    startDate: input.startDate,
    period,
    deposit: input.depositSatang,
    advanceMonths: input.advanceMonths,
  });
  const year = Number(input.startDate.slice(0, 4));
  const month = Number(input.startDate.slice(5, 7));
  const sequence = await nextDocumentNumber(tx, tenantId, buildingRow!.id, 'INV', year);
  const number = formatDocumentNumber({
    prefix: 'INV',
    ceYear: year,
    month,
    sequence,
    style: buildingRow!.invoiceYearStyle as YearStyle,
  });
  const [created] = await scope
    .insert(invoice, [
      {
        buildingId: buildingRow!.id,
        contractId,
        number,
        type: 'move_in',
        period,
        issueDate: input.startDate,
        dueDate: isoFromDayNumber(dayNumber(input.startDate) + 7),
        status: 'sent',
        subtotalSatang: first.subtotal,
        totalSatang: first.total,
        paidSatang: 0,
        sentAt: new Date(),
        publicToken: crypto.randomUUID(),
      },
    ])
    .returning({ id: invoice.id });
  const invoiceId = created!.id;
  await scope.insert(
    invoiceLine,
    first.lines.map((line) => ({
      invoiceId,
      kind: line.kind,
      labelTh: LINE_LABELS[line.kind as keyof typeof LINE_LABELS]?.th ?? line.kind,
      labelEn: LINE_LABELS[line.kind as keyof typeof LINE_LABELS]?.en ?? line.kind,
      qty: 1,
      unitPriceSatang: line.amount,
      amountSatang: line.amount,
      meta: {},
    })),
  );

  return { contractId, invoiceId, invoiceNumber: number, total: first.total, daysOccupied: first.daysOccupied };
}

export async function giveNotice(tx: Tx, tenantId: string, input: { contractId: string; noticeDate: string }) {
  const scope = withTenant(tx, tenantId);
  const [found] = await scope.select(contract, eq(contract.id, input.contractId));
  if (!found) throw new ActionError('contract.not_found', 'contracts.errors.notFound');
  if (found.status !== 'active') throw new ActionError('contract.not_active', 'contracts.errors.notActive');
  await scope.update(
    contract,
    { status: 'notice_given', noticeDate: input.noticeDate },
    eq(contract.id, input.contractId),
  );
  return { contractId: input.contractId };
}

export type MoveOutInput = {
  contractId: string;
  moveOutDate: string;
  elecReading: number;
  waterReading: number;
  elecRollover: boolean;
  waterRollover: boolean;
  checklist: { key: string; status: 'ok' | 'damaged' | null }[];
  damages: number;
  cleaningFee: number;
};

/**
 * Works out the move-out settlement without writing anything. The preview shows this; `moveOut` commits the same
 * numbers.
 */
export async function prepareMoveOut(db: Queryable, tenantId: string, input: MoveOutInput) {
  const ctx = await loadMoveOutContext(db, tenantId, input.contractId, input.moveOutDate);
  if (!ctx) throw new ActionError('contract.not_found', 'contracts.errors.notFound');
  if (ctx.contract.status === 'ended') throw new ActionError('contract.not_active', 'contracts.errors.notActive');
  const plan = ctx.plan;
  if (!plan) throw new ActionError('rate_plan.missing', 'contracts.errors.noRatePlan');
  if (!ctx.lastElectricity || !ctx.lastWater) {
    throw new ActionError('meter.missing', 'contracts.errors.noMeter');
  }
  let result;
  try {
    result = moveOutSettlement({
      elec: {
        previous: ctx.lastElectricity.reading,
        current: input.elecReading,
        meterDigits: ctx.room.elecMeterDigits,
        rollover: input.elecRollover,
        rate: { ratePerUnit: plan.elecRateSatang, minCharge: plan.elecMinSatang },
      },
      water: {
        previous: ctx.lastWater.reading,
        current: input.waterReading,
        meterDigits: ctx.room.waterMeterDigits,
        rollover: input.waterRollover,
        rate:
          plan.waterMode === 'per_person'
            ? { mode: 'per_person', perPerson: plan.waterPerPersonSatang }
            : { mode: 'per_unit', ratePerUnit: plan.waterRateSatang, minCharge: plan.waterMinSatang },
        occupants: ctx.contract.occupants,
      },
      unpaid: ctx.unpaid,
      deposit: ctx.contract.depositReceivedSatang,
      damages: input.damages,
      cleaningFee: input.cleaningFee,
    });
  } catch (error) {
    if (error instanceof RangeError) throw new ActionError('meter.invalid', 'contracts.errors.meterInvalid');
    throw error;
  }
  return { ctx, result, checklist: checklistItems(input.checklist) };
}

export async function moveOut(tx: Tx, tenantId: string, input: MoveOutInput) {
  const { ctx, result, checklist: items } = await prepareMoveOut(tx, tenantId, input);
  const scope = withTenant(tx, tenantId);
  const period = input.moveOutDate.slice(0, 7);
  const readAt = startOfDay(input.moveOutDate);
  await upsertMeterReading(tx, tenantId, {
    roomId: ctx.room.id,
    kind: 'electricity',
    period,
    reading: input.elecReading,
    unitsUsed: result.units.electricity,
    readBy: 'move-out',
    readAt,
  });
  await upsertMeterReading(tx, tenantId, {
    roomId: ctx.room.id,
    kind: 'water',
    period,
    reading: input.waterReading,
    unitsUsed: result.units.water,
    readBy: 'move-out',
    readAt,
  });
  await scope.insert(checklist, [
    { contractId: input.contractId, kind: 'move_out', items, completedAt: new Date() },
  ]);
  await scope.insert(settlement, [
    {
      contractId: input.contractId,
      depositSatang: ctx.contract.depositReceivedSatang,
      deductions: result.deductions.map((d) => ({
        key: d.kind,
        labelTh: DEDUCTION_LABELS[d.kind].th,
        labelEn: DEDUCTION_LABELS[d.kind].en,
        amountSatang: d.amount,
      })),
      refundSatang: result.refund,
      settledAt: new Date(),
    },
  ]);
  await scope.update(contract, { status: 'ended', endDate: input.moveOutDate }, eq(contract.id, input.contractId));
  return { contractId: input.contractId, refund: result.refund, deductions: result.deductions };
}
