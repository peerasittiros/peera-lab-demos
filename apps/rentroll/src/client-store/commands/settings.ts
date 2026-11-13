import { formatOrder, moved, parseOrder } from '@/src/domain/order';
import { newId } from '../ids';
import { floorOrder, roomTypeOrderValue } from '../selectors/settings';
import {
  floorsKey,
  isSettingKey,
  maxLengthOf,
  roomTypesKey,
} from '../setting-keys';
import type { Inputs } from '../schemas';
import {
  loadSchemas,
  type CommandContext,
  type CommandResult,
} from './payments';

/**
 * Settings commands (ux-v2/rentroll.md › Settings): the details kept in this browser, and the names and order of the
 * room types. Owner only, as every settings page is. Nothing here touches the server.
 */

const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});

/** Saves one browser setting, or clears it with `null`. */
export async function actSaveSetting(
  ctx: CommandContext,
  input: { key: string; value: string | null },
): Promise<CommandResult<{ key: string }>> {
  if (ctx.role !== 'owner') return fail('errors.forbidden');
  if (!isSettingKey(input.key)) return fail('settings.errors.unknownKey');
  const value = input.value === null ? '' : input.value.trim();
  if (value.length > maxLengthOf(input.key))
    return fail('settings.errors.tooLong');
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'setting.set',
    payload: { key: input.key, value: value === '' ? null : value },
  });
  return ok
    ? { ok: true, value: { key: input.key } }
    : fail('errors.unexpected');
}

/** Renames a room type, keeping its place in the order. */
export async function actUpdateRoomType(
  ctx: CommandContext,
  input: Inputs['roomType'],
): Promise<CommandResult<{ roomTypeId: string }>> {
  if (ctx.role !== 'owner') return fail('errors.forbidden');
  const parsed = (await loadSchemas()).roomTypeInput.safeParse(input);
  if (!parsed.success) return fail('property.errors.invalid');
  const type = ctx.store
    .getState()
    .data.room_type.find((t) => t.id === parsed.data.roomTypeId);
  if (!type) return fail('property.errors.notFound');
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'room_type.update',
    payload: parsed.data,
  });
  return ok
    ? { ok: true, value: { roomTypeId: type.id } }
    : fail('property.errors.saveFailed');
}

/** Moves a room type one place within its building, and stores the whole order so nothing else shifts. */
export async function actMoveRoomType(
  ctx: CommandContext,
  input: { roomTypeId: string; direction: 'up' | 'down' },
): Promise<CommandResult<{ position: number }>> {
  if (ctx.role !== 'owner') return fail('errors.forbidden');
  const data = ctx.store.getState().data;
  const type = data.room_type.find((t) => t.id === input.roomTypeId);
  if (!type) return fail('property.errors.notFound');
  const order = roomTypeOrderValue(data, type.buildingId).split(',');
  const next = moved(order, order.indexOf(type.id), input.direction);
  if (next === order)
    return { ok: true, value: { position: order.indexOf(type.id) } };
  const key = roomTypesKey(type.buildingId);
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'setting.set',
    payload: { key, value: formatOrder(next) },
  });
  return ok
    ? { ok: true, value: { position: next.indexOf(type.id) } }
    : fail('property.errors.saveFailed');
}

/** Moves a floor one place in the plan's switch and sections. */
export async function actMoveFloor(
  ctx: CommandContext,
  input: { buildingId: string; floor: number; direction: 'up' | 'down' },
): Promise<CommandResult<{ position: number }>> {
  if (ctx.role !== 'owner') return fail('errors.forbidden');
  const data = ctx.store.getState().data;
  if (!data.building.some((b) => b.id === input.buildingId))
    return fail('property.errors.notFound');
  const floors = floorOrder(data, input.buildingId);
  const next = moved(floors, floors.indexOf(input.floor), input.direction);
  if (next === floors)
    return { ok: true, value: { position: floors.indexOf(input.floor) } };
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'setting.set',
    payload: { key: floorsKey(input.buildingId), value: formatOrder(next) },
  });
  return ok
    ? { ok: true, value: { position: next.indexOf(input.floor) } }
    : fail('property.errors.saveFailed');
}

/** Removes a room type that no room uses. A type in use stays: the rooms need it. */
export async function actRemoveRoomType(
  ctx: CommandContext,
  input: { roomTypeId: string },
): Promise<CommandResult<{ roomTypeId: string }>> {
  if (ctx.role !== 'owner') return fail('errors.forbidden');
  const data = ctx.store.getState().data;
  const type = data.room_type.find((t) => t.id === input.roomTypeId);
  if (!type) return fail('property.errors.notFound');
  if (data.room.some((r) => r.roomTypeId === type.id))
    return fail('property.errors.roomTypeInUse');
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'room_type.remove',
    payload: { roomTypeId: type.id },
  });
  if (!ok) return fail('property.errors.saveFailed');
  // The stored order no longer needs the removed id; leaving it would be harmless but untidy.
  const order = parseOrder(roomTypeOrderValue(data, type.buildingId));
  if (order.includes(type.id)) {
    ctx.store.dispatch({
      id: newId(),
      at: ctx.now().toISOString(),
      role: ctx.role,
      kind: 'setting.set',
      payload: {
        key: roomTypesKey(type.buildingId),
        value: formatOrder(order.filter((id) => id !== type.id)),
      },
    });
  }
  return { ok: true, value: { roomTypeId: type.id } };
}
