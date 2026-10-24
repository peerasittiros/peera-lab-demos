import { describe, expect, it } from 'vitest';
import { memoryPersistence } from '../idb';
import { createStore, type Store } from '../store';
import { snapshotFor } from '../testing';
import type { Role } from '../schema';
import type { CommandContext } from './payments';
import { actUpdateRoom } from './property';

const TODAY = '2026-10-24';

async function readyStore(): Promise<Store> {
  const store = createStore({
    openPersistence: async () => memoryPersistence(),
    fetchSnapshot: async () => snapshotFor(TODAY),
    openSync: () => null,
    today: () => TODAY,
  });
  await store.start();
  return store;
}

const ctx = (store: Store, role: Role): CommandContext => ({
  store,
  role,
  now: () => new Date('2026-10-24T05:00:00.000Z'),
});

/** A room, the type its own building offers, and a room number another room in that building already uses. */
function roomCase(store: Store) {
  const data = store.getState().data;
  const room = data.room[0]!;
  const type = data.room_type.find((t) => t.buildingId === room.buildingId)!;
  const other = data.room.find(
    (r) => r.buildingId === room.buildingId && r.id !== room.id,
  )!;
  const foreignType = data.room_type.find(
    (t) => t.buildingId !== room.buildingId,
  )!;
  return { room, type, other, foreignType };
}

const base = (
  room: { id: string; number: string; floor: number },
  roomTypeId: string,
) => ({
  roomId: room.id,
  number: room.number,
  floor: room.floor,
  roomTypeId,
  sizeSqm: 24.5,
  elecMeterDigits: 5,
  waterMeterDigits: 4,
});

describe('actUpdateRoom', () => {
  it('saves the room fields', async () => {
    const store = await readyStore();
    const { room, type } = roomCase(store);
    const result = actUpdateRoom(ctx(store, 'owner'), {
      ...base(room, type.id),
      number: 'Z-901',
      floor: 9,
      sizeSqm: 30,
    });
    expect(result.ok).toBe(true);
    expect(
      store.getState().data.room.find((r) => r.id === room.id),
    ).toMatchObject({
      number: 'Z-901',
      floor: 9,
      sizeSqm: 30,
      roomTypeId: type.id,
    });
  });

  it('refuses a number another room in the building already uses', async () => {
    const store = await readyStore();
    const { room, type, other } = roomCase(store);
    expect(actUpdateRoom(ctx(store, 'owner'), base(room, type.id)).ok).toBe(
      true,
    );
    expect(
      actUpdateRoom(ctx(store, 'owner'), {
        ...base(room, type.id),
        number: other.number,
      }),
    ).toEqual({ ok: false, error: 'property.errors.roomDuplicate' });
  });

  it('refuses a room type from another building', async () => {
    const store = await readyStore();
    const { room, foreignType } = roomCase(store);
    expect(
      actUpdateRoom(ctx(store, 'owner'), base(room, foreignType.id)),
    ).toEqual({ ok: false, error: 'property.errors.invalid' });
  });

  it('is owner only', async () => {
    const store = await readyStore();
    const { room, type } = roomCase(store);
    expect(actUpdateRoom(ctx(store, 'caretaker'), base(room, type.id))).toEqual(
      { ok: false, error: 'errors.forbidden' },
    );
  });
});
