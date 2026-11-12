/**
 * The settings this demo keeps in the visitor's browser, by key (ux-v2/rentroll.md › Settings). A key is validated
 * before it is stored, so a typo in a page cannot leave an unread row behind in the store.
 */

export const SETTING = {
  logo: 'building.logo',
  phone: 'building.phone',
  noteTh: 'billing.noteTh',
  noteEn: 'billing.noteEn',
  ownerName: 'people.owner',
  caretakerName: 'people.caretaker',
  tenantName: 'people.tenant',
} as const;

/** The per-building orders: floors shown in the plan, room types shown in lists and the move-in form. */
export const floorsKey = (buildingId: string) => `floors.order.${buildingId}`;
export const roomTypesKey = (buildingId: string) => `room_types.order.${buildingId}`;

const PER_BUILDING = [/^floors\.order\.[0-9a-f-]{36}$/, /^room_types\.order\.[0-9a-f-]{36}$/];

/** Whether a page may write this key. */
export function isSettingKey(key: string): boolean {
  return (
    Object.values(SETTING).includes(key as (typeof SETTING)[keyof typeof SETTING]) ||
    PER_BUILDING.some((pattern) => pattern.test(key))
  );
}

/** How long a value may be: the logo is a data URL, the rest are names and short lines. */
export function maxLengthOf(key: string): number {
  return key === SETTING.logo ? 400_000 : 300;
}
