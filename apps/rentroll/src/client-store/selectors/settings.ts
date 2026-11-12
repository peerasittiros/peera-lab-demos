import { byStoredOrder, formatOrder, parseOrder } from '@/src/domain/order';
import type { Data, Row } from '../schema';
import { floorsKey, roomTypesKey, SETTING } from '../setting-keys';

/** The settings the owner keeps in this browser, read out of the store's `setting` rows. */
export function settingValue(data: Data, key: string): string | null {
  return data.setting.find((row) => row.id === key)?.value ?? null;
}

/** One place to read what Settings saved, so a page never guesses at a key. Empty means "not set". */
export type SettingsView = {
  logoUrl: string | null;
  phone: string | null;
  noteTh: string | null;
  noteEn: string | null;
  ownerName: string | null;
  caretakerName: string | null;
  tenantName: string | null;
};

const text = (data: Data, key: string) => {
  const value = settingValue(data, key)?.trim() ?? '';
  return value === '' ? null : value;
};

export function settingsView(data: Data): SettingsView {
  return {
    logoUrl: text(data, SETTING.logo),
    phone: text(data, SETTING.phone),
    noteTh: text(data, SETTING.noteTh),
    noteEn: text(data, SETTING.noteEn),
    ownerName: text(data, SETTING.ownerName),
    caretakerName: text(data, SETTING.caretakerName),
    tenantName: text(data, SETTING.tenantName),
  };
}

/** A building's floors, as the plan shows them: the saved order first, then any floor it has not seen. */
export function floorOrder(data: Data, buildingId: string): number[] {
  const floors = [
    ...new Set(
      data.room.filter((r) => r.buildingId === buildingId).map((r) => r.floor),
    ),
  ].sort((a, b) => a - b);
  return byStoredOrder(floors, parseOrder(settingValue(data, floorsKey(buildingId))), (floor) => floor);
}

/** A building's room types in the owner's order. */
export function orderedRoomTypes(
  data: Data,
  buildingId: string,
): Row<'room_type'>[] {
  const types = data.room_type.filter((t) => t.buildingId === buildingId);
  return byStoredOrder(
    types,
    parseOrder(settingValue(data, roomTypesKey(buildingId))),
    (type) => type.id,
  );
}

/** The order a move or a removal should store, so unsaved types don't lose their place. */
export function roomTypeOrderValue(data: Data, buildingId: string): string {
  return formatOrder(orderedRoomTypes(data, buildingId).map((t) => t.id));
}
