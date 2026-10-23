'use server';

import { assertRowCap } from '@peera/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ratePlan, room, roomType } from '../db/schema';
import { addRatePlan, saveBuilding, saveRoom, saveRoomType, setRoomMaintenance } from '../db/writes/property';
import { ROW_CAPS, defineAction } from '../server/actions';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const satang = z.number().int().min(0).max(1_000_000_000_00);
const day = z.number().int().min(1).max(28);
const owner = { roles: ['owner'] } as const;

export const saveBuildingSettings = defineAction(
  z.object({
    buildingId: z.uuid(),
    nameTh: z.string().trim().min(1).max(120),
    nameEn: z.string().trim().max(120).nullable(),
    addressTh: z.string().trim().max(300).nullable(),
    addressEn: z.string().trim().max(300).nullable(),
    promptpayId: z.string().trim().min(1).max(40),
    bankName: z.string().trim().max(80).nullable(),
    bankAccountMasked: z.string().trim().max(40).nullable(),
    billingDay: day,
    dueDay: day,
    invoiceYearStyle: z.enum(['be', 'ce']),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) => saveBuilding(tx, { tenantId, ...input }));
    revalidatePath('/', 'layout');
    return result;
  },
);

export const saveRoomTypeSettings = defineAction(
  z.object({
    id: z.uuid().optional(),
    buildingId: z.uuid(),
    nameTh: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().max(80).nullable(),
    monthlyRentSatang: satang,
    dailyRentSatang: satang.nullable(),
    depositSatang: satang,
    advanceMonths: z.number().int().min(0).max(12),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction(async (tx) => {
      if (!input.id) await assertRowCap(tx, roomType, tenantId, ROW_CAPS.roomTypes);
      return saveRoomType(tx, tenantId, input);
    });
    revalidatePath('/', 'layout');
    return result;
  },
);

export const addRatePlanSettings = defineAction(
  z.object({
    buildingId: z.uuid(),
    validFrom: isoDate,
    elecRateSatang: satang,
    elecMinSatang: satang,
    waterMode: z.enum(['per_unit', 'per_person']),
    waterRateSatang: satang,
    waterMinSatang: satang,
    waterPerPersonSatang: satang,
    commonFeeSatang: satang,
    lateFeeRule: z.object({
      kind: z.enum(['per_day', 'once']),
      amountSatang: satang,
      capSatang: satang,
    }),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction(async (tx) => {
      await assertRowCap(tx, ratePlan, tenantId, ROW_CAPS.ratePlans);
      return addRatePlan(tx, tenantId, input);
    });
    revalidatePath('/', 'layout');
    return result;
  },
);

export const saveRoomSettings = defineAction(
  z.object({
    id: z.uuid().optional(),
    buildingId: z.uuid(),
    number: z.string().trim().min(1).max(12),
    floor: z.number().int().min(0).max(60),
    roomTypeId: z.uuid(),
    sizeSqm: z.number().min(0).max(10_000).nullable(),
    elecMeterDigits: z.number().int().min(3).max(8),
    waterMeterDigits: z.number().int().min(3).max(8),
    sort: z.number().int().min(0).max(10_000),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction(async (tx) => {
      if (!input.id) await assertRowCap(tx, room, tenantId, ROW_CAPS.rooms);
      return saveRoom(tx, tenantId, input);
    });
    revalidatePath('/', 'layout');
    return result;
  },
);

export const setRoomMaintenanceFlag = defineAction(
  z.object({ roomId: z.uuid(), maintenance: z.boolean() }),
  owner,
  async ({ roomId, maintenance }, { db, tenantId }) => {
    const result = await db.transaction((tx) => setRoomMaintenance(tx, tenantId, roomId, maintenance));
    revalidatePath('/', 'layout');
    return result;
  },
);
