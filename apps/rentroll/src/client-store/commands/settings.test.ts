import { describe, expect, it } from 'vitest';
import { byStoredOrder, formatOrder, moved, parseOrder } from '@/src/domain/order';
import { memoryPersistence } from '../idb';
import { createStore, type Store } from '../store';
import { snapshotFor } from '../testing';
import type { Role, Snapshot } from '../schema';
import { settingValue } from '../selectors/settings';
import { floorsKey, roomTypesKey, SETTING } from '../setting-keys';
import type { CommandContext } from './payments';
import {
  actMoveFloor,
  actMoveRoomType,
  actRemoveRoomType,
  actSaveSetting,
  actUpdateRoomType,
} from './settings';

const TODAY = '2026-10-24';

/** The snapshot with one room type no room uses, so the delete rule can be seen to work. */
function snapshotWithSpareType(today: string): Snapshot {
  const snapshot = snapshotFor(today);
  const building = snapshot.tables.building![0]!;
  snapshot.tables.room_type = [
    ...(snapshot.tables.room_type ?? []),
    {
      id: '00000000-0000-4000-8000-0000000000aa',
      buildingId: building.id,
      nameTh: 'ประเภทที่ยังไม่มีห้อง',
      nameEn: 'Spare type',
      monthlyRentSatang: 400_000,
      dailyRentSatang: null,
      depositSatang: 800_000,
      advanceMonths: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  return snapshot;
}

async function readyStore(today = TODAY): Promise<Store> {
  const store = createStore({
    openPersistence: async () => memoryPersistence(),
    fetchSnapshot: async () => snapshotWithSpareType(today),
    openSync: () => null,
    today: () => today,
  });
  await store.start();
  return store;
}

const ctx = (store: Store, role: Role): CommandContext => ({
  store,
  role,
  now: () => new Date('2026-10-24T05:00:00.000Z'), // 12:00 in Bangkok
});

const buildingsOf = (store: Store) => store.getState().data.building;

describe('actSaveSetting', () => {
  it('keeps a phone in the browser and clears it again', async () => {
    const store = await readyStore();
    const result = actSaveSetting(ctx(store, 'owner'), {
      key: SETTING.phone,
      value: ' 02-123-4567 ',
    });
    expect(result).toEqual({ ok: true, value: { key: SETTING.phone } });
    expect(settingValue(store.getState().data, SETTING.phone)).toBe('02-123-4567');
    expect(
      actSaveSetting(ctx(store, 'owner'), {
        key: SETTING.phone,
        value: null,
      }).ok,
    ).toBe(true);
    expect(settingValue(store.getState().data, SETTING.phone)).toBeNull();
  });

  it('refuses a key no page writes', async () => {
    const store = await readyStore();
    expect(
      actSaveSetting(ctx(store, 'owner'), { key: 'nonsense', value: 'x' }),
    ).toEqual({ ok: false, error: 'settings.errors.unknownKey' });
  });

  it('refuses a value longer than its key allows', async () => {
    const store = await readyStore();
    expect(
      actSaveSetting(ctx(store, 'owner'), {
        key: SETTING.ownerName,
        value: 'x'.repeat(301),
      }),
    ).toEqual({ ok: false, error: 'settings.errors.tooLong' });
  });

  it('is owner only', async () => {
    const store = await readyStore();
    expect(
      actSaveSetting(ctx(store, 'caretaker'), {
        key: SETTING.logo,
        value: 'data:image/webp;base64,AA',
      }),
    ).toEqual({ ok: false, error: 'errors.forbidden' });
  });
});

describe('actUpdateRoomType', () => {
  it('renames a type and keeps its place', async () => {
    const store = await readyStore();
    const type = store.getState().data.room_type[0]!;
    const result = actUpdateRoomType(ctx(store, 'owner'), {
      roomTypeId: type.id,
      nameTh: 'ห้องพัดลม (ใหม่)',
      nameEn: 'Fan room (new)',
    });
    expect(result.ok).toBe(true);
    const after = store
      .getState()
      .data.room_type.find((t) => t.id === type.id)!;
    expect(after.nameTh).toBe('ห้องพัดลม (ใหม่)');
    expect(after.nameEn).toBe('Fan room (new)');
    expect(after.monthlyRentSatang).toBe(type.monthlyRentSatang);
  });

  it('refuses an empty name and an unknown id', async () => {
    const store = await readyStore();
    const type = store.getState().data.room_type[0]!;
    expect(
      actUpdateRoomType(ctx(store, 'owner'), {
        roomTypeId: type.id,
        nameTh: '   ',
        nameEn: null,
      }),
    ).toEqual({ ok: false, error: 'property.errors.invalid' });
    expect(
      actUpdateRoomType(ctx(store, 'owner'), {
        roomTypeId: '00000000-0000-4000-8000-00000000dead',
        nameTh: 'ไม่มีจริง',
        nameEn: null,
      }),
    ).toEqual({ ok: false, error: 'property.errors.notFound' });
  });

  it('is owner only', async () => {
    const store = await readyStore();
    const type = store.getState().data.room_type[0]!;
    expect(
      actUpdateRoomType(ctx(store, 'caretaker'), {
        roomTypeId: type.id,
        nameTh: 'x',
        nameEn: null,
      }),
    ).toEqual({ ok: false, error: 'errors.forbidden' });
  });
});

describe('actMoveRoomType', () => {
  it('moves a type one place and stores the whole order for its building', async () => {
    const store = await readyStore();
    const buildingId = buildingsOf(store)[0]!.id;
    const types = store
      .getState()
      .data.room_type.filter((t) => t.buildingId === buildingId);
    const first = types[0]!;
    const second = types[1]!;
    const result = actMoveRoomType(ctx(store, 'owner'), {
      roomTypeId: second.id,
      direction: 'up',
    });
    expect(result).toEqual({ ok: true, value: { position: 0 } });
    expect(
      parseOrder(settingValue(store.getState().data, roomTypesKey(buildingId))),
    ).toEqual([second.id, first.id, ...types.slice(2).map((t) => t.id)]);
  });

  it('does not move the first type up', async () => {
    const store = await readyStore();
    const buildingId = buildingsOf(store)[0]!.id;
    const first = store
      .getState()
      .data.room_type.find((t) => t.buildingId === buildingId)!;
    expect(
      actMoveRoomType(ctx(store, 'owner'), {
        roomTypeId: first.id,
        direction: 'up',
      }),
    ).toEqual({ ok: true, value: { position: 0 } });
    expect(settingValue(store.getState().data, roomTypesKey(buildingId))).toBeNull();
  });

  it('is owner only', async () => {
    const store = await readyStore();
    const type = store.getState().data.room_type[0]!;
    expect(
      actMoveRoomType(ctx(store, 'caretaker'), {
        roomTypeId: type.id,
        direction: 'down',
      }),
    ).toEqual({ ok: false, error: 'errors.forbidden' });
  });
});

describe('actMoveFloor', () => {
  it('moves a floor one place and stores the order', async () => {
    const store = await readyStore();
    const buildingId = buildingsOf(store)[0]!.id;
    expect(
      actMoveFloor(ctx(store, 'owner'), {
        buildingId,
        floor: 2,
        direction: 'up',
      }),
    ).toEqual({ ok: true, value: { position: 0 } });
    expect(
      parseOrder(settingValue(store.getState().data, floorsKey(buildingId))),
    ).toEqual(['2', '1', '3', '4']);
  });

  it('does not move the lowest floor down', async () => {
    const store = await readyStore();
    const buildingId = buildingsOf(store)[0]!.id;
    expect(
      actMoveFloor(ctx(store, 'owner'), {
        buildingId,
        floor: 1,
        direction: 'up',
      }),
    ).toEqual({ ok: true, value: { position: 0 } });
  });

  it('refuses a building that is not there', async () => {
    const store = await readyStore();
    expect(
      actMoveFloor(ctx(store, 'owner'), {
        buildingId: '00000000-0000-4000-8000-00000000dead',
        floor: 1,
        direction: 'up',
      }),
    ).toEqual({ ok: false, error: 'property.errors.notFound' });
  });
});

describe('actRemoveRoomType', () => {
  it('removes a type no room uses', async () => {
    const store = await readyStore();
    const spare = store
      .getState()
      .data.room_type.find((t) => t.nameEn === 'Spare type')!;
    expect(
      actRemoveRoomType(ctx(store, 'owner'), { roomTypeId: spare.id }),
    ).toEqual({ ok: true, value: { roomTypeId: spare.id } });
    expect(
      store.getState().data.room_type.some((t) => t.id === spare.id),
    ).toBe(false);
  });

  it('keeps a type a room still uses', async () => {
    const store = await readyStore();
    const type = store.getState().data.room_type[0]!;
    expect(store.getState().data.room.some((r) => r.roomTypeId === type.id)).toBe(
      true,
    );
    expect(
      actRemoveRoomType(ctx(store, 'owner'), { roomTypeId: type.id }),
    ).toEqual({ ok: false, error: 'property.errors.roomTypeInUse' });
  });

  it('drops the removed id from the saved order', async () => {
    const store = await readyStore();
    const spare = store
      .getState()
      .data.room_type.find((t) => t.nameEn === 'Spare type')!;
    const buildingId = spare.buildingId;
    actMoveRoomType(ctx(store, 'owner'), {
      roomTypeId: spare.id,
      direction: 'up',
    });
    const before = parseOrder(
      settingValue(store.getState().data, roomTypesKey(buildingId)),
    );
    expect(before).toContain(spare.id);
    actRemoveRoomType(ctx(store, 'owner'), { roomTypeId: spare.id });
    const after = parseOrder(
      settingValue(store.getState().data, roomTypesKey(buildingId)),
    );
    expect(after).not.toContain(spare.id);
    expect(after).toEqual(before.filter((id) => id !== spare.id));
  });

  it('is owner only', async () => {
    const store = await readyStore();
    const spare = store
      .getState()
      .data.room_type.find((t) => t.nameEn === 'Spare type')!;
    expect(
      actRemoveRoomType(ctx(store, 'caretaker'), { roomTypeId: spare.id }),
    ).toEqual({ ok: false, error: 'errors.forbidden' });
  });
});

describe('order helpers', () => {
  it('reads a stored list without blanks or repeats', () => {
    expect(parseOrder(' b , ,a,b ')).toEqual(['b', 'a']);
    expect(parseOrder(null)).toEqual([]);
  });

  it('puts known keys first and leaves the rest in place', () => {
    expect(
      byStoredOrder(['a', 'b', 'c', 'd'], ['c', 'a'], (key) => key),
    ).toEqual(['c', 'a', 'b', 'd']);
    expect(byStoredOrder([1, 2, 3], ['3'], (n) => n)).toEqual([3, 1, 2]);
  });

  it('moves one place and holds still at the ends', () => {
    expect(moved(['a', 'b', 'c'], 1, 'up')).toEqual(['b', 'a', 'c']);
    expect(moved(['a', 'b'], 0, 'up')).toEqual(['a', 'b']);
    expect(moved(['a', 'b'], 1, 'down')).toEqual(['a', 'b']);
  });

  it('formats an order', () => {
    expect(formatOrder(['x', 2])).toBe('x,2');
  });
});
