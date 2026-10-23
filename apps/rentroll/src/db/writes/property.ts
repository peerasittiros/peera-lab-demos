import { ActionError, withTenant, type Tx } from '@peera/db';
import { and, eq } from 'drizzle-orm';
import { building, ratePlan, room, roomType } from '../schema';

/** Postgres error code of a Drizzle/pg error, read from the error or its causes. */
function pgCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string' && /^\d{5}$/.test(candidate.code)) return candidate.code;
    current = candidate.cause;
  }
  return null;
}

export type BuildingSettings = {
  nameTh: string;
  nameEn: string | null;
  addressTh: string | null;
  addressEn: string | null;
  /** Demo-fake PromptPay ID (01 §6.3). */
  promptpayId: string;
  bankName: string | null;
  bankAccountMasked: string | null;
  billingDay: number;
  dueDay: number;
  invoiceYearStyle: 'be' | 'ce';
};

/** Edits a building's settings. Buildings are created by the seed, not from the UI in the demo. */
export async function saveBuilding(
  tx: Tx,
  { tenantId, buildingId, ...settings }: BuildingSettings & { tenantId: string; buildingId: string },
) {
  const scope = withTenant(tx, tenantId);
  const [updated] = await scope.update(building, settings, eq(building.id, buildingId)).returning({ id: building.id });
  if (!updated) throw new ActionError('building.not_found', 'property.errors.notFound');
  return { buildingId };
}

export type RoomTypeInput = {
  id?: string;
  buildingId: string;
  nameTh: string;
  nameEn: string | null;
  monthlyRentSatang: number;
  dailyRentSatang: number | null;
  depositSatang: number;
  advanceMonths: number;
};

/** Creates or edits a room type. Editing a type does not change contracts or invoices, which copy their rent. */
export async function saveRoomType(tx: Tx, tenantId: string, input: RoomTypeInput) {
  const { id, ...values } = input;
  const scope = withTenant(tx, tenantId);
  if (id) {
    const [row] = await scope
      .update(roomType, values, eq(roomType.id, id))
      .returning({ id: roomType.id });
    if (!row) throw new ActionError('room_type.not_found', 'property.errors.notFound');
    return { id };
  }
  const [row] = await scope.insert(roomType, [values]).returning({ id: roomType.id });
  return { id: row!.id };
}

export type RatePlanInput = {
  buildingId: string;
  validFrom: string;
  elecRateSatang: number;
  elecMinSatang: number;
  waterMode: 'per_unit' | 'per_person';
  waterRateSatang: number;
  waterMinSatang: number;
  waterPerPersonSatang: number;
  commonFeeSatang: number;
  lateFeeRule: { kind: 'per_day' | 'once'; amountSatang: number; capSatang: number };
};

/**
 * Adds a rate plan that takes effect on `validFrom`. Plans are never edited: a rate change is a new plan, so
 * invoices already issued keep the amounts they were billed with (01 §3.1 A, §4).
 */
export async function addRatePlan(tx: Tx, tenantId: string, input: RatePlanInput) {
  const scope = withTenant(tx, tenantId);
  const [existing] = await scope.select(
    ratePlan,
    and(eq(ratePlan.buildingId, input.buildingId), eq(ratePlan.validFrom, input.validFrom)),
  );
  if (existing) throw new ActionError('rate_plan.duplicate_date', 'property.errors.ratePlanDuplicate');
  const [row] = await scope.insert(ratePlan, [input]).returning({ id: ratePlan.id });
  return { id: row!.id };
}

export type RoomInput = {
  id?: string;
  buildingId: string;
  number: string;
  floor: number;
  roomTypeId: string;
  sizeSqm: number | null;
  elecMeterDigits: number;
  waterMeterDigits: number;
  sort: number;
};

/** Creates or edits a room. The room number is unique per building. */
export async function saveRoom(tx: Tx, tenantId: string, input: RoomInput) {
  const { id, ...values } = input;
  const scope = withTenant(tx, tenantId);
  try {
    if (id) {
      const [row] = await scope.update(room, values, eq(room.id, id)).returning({ id: room.id });
      if (!row) throw new ActionError('room.not_found', 'property.errors.notFound');
      return { id };
    }
    const [row] = await scope.insert(room, [values]).returning({ id: room.id });
    return { id: row!.id };
  } catch (error) {
    if (pgCode(error) === "23505") {
      throw new ActionError('room.duplicate_number', 'property.errors.roomDuplicate');
    }
    throw error;
  }
}

/** The only room status set by hand (01 §4). Everything else comes from contracts. */
export async function setRoomMaintenance(tx: Tx, tenantId: string, roomId: string, maintenance: boolean) {
  const scope = withTenant(tx, tenantId);
  const [row] = await scope.update(room, { maintenance }, eq(room.id, roomId)).returning({ id: room.id });
  if (!row) throw new ActionError('room.not_found', 'property.errors.notFound');
  return { id: roomId, maintenance };
}
