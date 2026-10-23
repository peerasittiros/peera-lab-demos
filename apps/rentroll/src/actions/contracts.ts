'use server';

import { assertRowCap } from '@peera/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CHECKLIST_KEYS } from '../domain/move';
import { contract } from '../db/schema';
import { giveNotice, moveIn, moveOut, prepareMoveOut, saveRenter } from '../db/writes/contracts';
import { ROW_CAPS, defineAction } from '../server/actions';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().int().min(0).max(1_000_000_000_00);
const owner = { roles: ['owner'] } as const;
const checklistMarks = z.array(
  z.object({ key: z.enum(CHECKLIST_KEYS), status: z.enum(['ok', 'damaged']).nullable() }),
);
const emergency = z.object({ name: z.string().trim().min(1).max(80), phone: z.string().trim().min(1).max(30) }).nullable();

export const saveRenterProfile = defineAction(
  z.object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(30).nullable(),
    emergencyContact: emergency,
    note: z.string().trim().max(500).nullable(),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) => saveRenter(tx, tenantId, input));
    revalidatePath('/', 'layout');
    return result;
  },
);

export const moveInTenant = defineAction(
  z.object({
    roomId: z.uuid(),
    renter: z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal('new'),
        name: z.string().trim().min(1).max(120),
        phone: z.string().trim().max(30).nullable(),
        emergencyContact: emergency,
      }),
      z.object({ mode: z.literal('existing'), renterId: z.uuid() }),
    ]),
    startDate: isoDate,
    monthlyRentSatang: money,
    depositSatang: money,
    advanceMonths: z.number().int().min(0).max(12),
    occupants: z.number().int().min(1).max(4),
    parkingSatang: money,
    internetSatang: money,
    elecReading: z.number().int().min(0).max(99_999_999),
    waterReading: z.number().int().min(0).max(99_999_999),
    checklist: checklistMarks,
    note: z.string().trim().max(500).nullable(),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction(async (tx) => {
      await assertRowCap(tx, contract, tenantId, ROW_CAPS.contracts);
      return moveIn(tx, tenantId, input);
    });
    revalidatePath('/', 'layout');
    return result;
  },
);

export const giveNoticeTenant = defineAction(
  z.object({ contractId: z.uuid(), noticeDate: isoDate }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) => giveNotice(tx, tenantId, input));
    revalidatePath('/', 'layout');
    return result;
  },
);

const moveOutInput = z.object({
  contractId: z.uuid(),
  moveOutDate: isoDate,
  elecReading: z.number().int().min(0).max(99_999_999),
  waterReading: z.number().int().min(0).max(99_999_999),
  elecRollover: z.boolean(),
  waterRollover: z.boolean(),
  checklist: checklistMarks,
  damages: money,
  cleaningFee: money,
});

/** Read-only: the settlement figures for the form to show before the owner confirms. */
export const previewMoveOutSettlement = defineAction(moveOutInput, { ...owner, write: false }, async (input, { db, tenantId }) => {
  const { result, ctx, checklist } = await prepareMoveOut(db, tenantId, input);
  return {
    units: result.units,
    utilities: result.utilities,
    deductions: result.deductions,
    refund: result.refund,
    unpaid: ctx.unpaid,
    deposit: ctx.contract.depositReceivedSatang,
    moveInItems: ctx.moveInItems,
    moveOutItems: checklist,
  };
});

export const moveOutTenant = defineAction(moveOutInput, owner, async (input, { db, tenantId }) => {
  const result = await db.transaction((tx) => moveOut(tx, tenantId, input));
  revalidatePath('/', 'layout');
  return result;
});

