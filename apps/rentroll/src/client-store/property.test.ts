import { describe, expect, it } from 'vitest';
import { memoryPersistence } from './idb';
import type { CommandContext } from './commands/payments';
import {
  actAddRepairNote,
  actCreateRepair,
  actMoveRepair,
  actUpdateRepair,
} from './commands/property';
import {
  actGiveNotice,
  actPostAnnouncement,
  actSetMaintenance,
  actSendReminder,
} from './commands/property';
import { actMoveIn, actMoveOut } from './commands/contracts';
import { overdueList } from './selectors/overdue';
import { repairsBoard, ticketThread, tenantTickets } from './selectors/repairs';
import {
  liveContractOf,
  roomMap,
  moveOutPreview,
  roomDetail,
} from './selectors/property';
import { readingHistory } from './selectors/meters';
import { tenantMessages } from './selectors/live';
import { tenantContract } from './selectors/tenant';
import { createStore, type Store } from './store';
import { snapshotFor } from './testing';
import type { Role } from './schema';
import { CHECKLIST_KEYS } from '@/src/domain/move';

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

const liveRoom = (store: Store) => {
  const data = store.getState().data;
  return data.room.find(
    (r) => !r.maintenance && liveContractOf(data, r.id, TODAY),
  )!;
};

describe('repair tickets', () => {
  it('a tenant request appears on the board; moving it to done closes it; a closed ticket does not move again', async () => {
    const store = await readyStore();
    const room = liveRoom(store);
    const created = actCreateRepair(ctx(store, 'tenant'), {
      roomId: room.id,
      category: 'plumbing',
      description: 'Tap leaks',
      preferredTime: 'morning',
      allowEntry: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(repairsBoard(store.getState().data)[0]).toMatchObject({
      id: created.value.ticketId,
      status: 'new',
      roomNumber: room.number,
    });
    expect(
      ticketThread(store.getState().data, created.value.ticketId)[0],
    ).toMatchObject({ authorRole: 'tenant', body: 'Tap leaks' });

    expect(
      actMoveRepair(ctx(store, 'owner'), {
        ticketId: created.value.ticketId,
        status: 'done',
      }).ok,
    ).toBe(true);
    const closed = store
      .getState()
      .data.repair_ticket.find((t) => t.id === created.value.ticketId)!;
    expect(closed.closedAt).not.toBeNull();
    expect(
      actMoveRepair(ctx(store, 'owner'), {
        ticketId: created.value.ticketId,
        status: 'new',
      }),
    ).toEqual({
      ok: false,
      error: 'ownerRepairs.errors.closed',
    });
  });

  it('billing the tenant needs a cost; a note joins the timeline; the tenant sees the ticket with its messages', async () => {
    const store = await readyStore();
    const room = store
      .getState()
      .data.room.find(
        (r) => r.id === tenantContract(store.getState().data, TODAY)!.roomId,
      )!;
    const created = actCreateRepair(ctx(store, 'tenant'), {
      roomId: room.id,
      category: 'aircon',
      description: 'Not cooling',
      preferredTime: 'anytime',
      allowEntry: false,
    });
    if (!created.ok) throw new Error('create failed');
    const id = created.value.ticketId;
    expect(
      actUpdateRepair(ctx(store, 'owner'), {
        ticketId: id,
        assignee: 'Somchai',
        scheduledAt: null,
        costSatang: null,
        billToRenter: true,
      }),
    ).toEqual({ ok: false, error: 'ownerRepairs.errors.billNeedsCost' });
    expect(
      actUpdateRepair(ctx(store, 'owner'), {
        ticketId: id,
        assignee: 'Somchai',
        scheduledAt: null,
        costSatang: 50000,
        billToRenter: true,
      }).ok,
    ).toBe(true);
    expect(
      actAddRepairNote(ctx(store, 'owner'), {
        ticketId: id,
        body: 'Coming Friday',
      }).ok,
    ).toBe(true);
    expect(ticketThread(store.getState().data, id).map((m) => m.body)).toEqual([
      'Not cooling',
      'Coming Friday',
    ]);
    expect(
      tenantTickets(store.getState().data, TODAY).some((t) => t.id === id),
    ).toBe(true);
  });

  it('a caretaker can move tickets, a tenant cannot', async () => {
    const store = await readyStore();
    const ticket = store.getState().data.repair_ticket[0];
    if (!ticket) return;
    expect(
      actMoveRepair(ctx(store, 'tenant'), {
        ticketId: ticket.id,
        status: 'scheduled',
      }),
    ).toEqual({
      ok: false,
      error: 'errors.forbidden',
    });
  });
});

describe('reminders, announcements, maintenance and notice', () => {
  it('a reminder is recorded for an overdue invoice and counted on the overdue list', async () => {
    const store = await readyStore();
    const overdue = overdueList(
      store.getState().data,
      store.getState().ops,
      TODAY,
      new Date('2026-10-24T05:00:00.000Z'),
    );
    if (overdue.length === 0) return;
    const first = overdue[0]!;
    expect(first.daysLate).toBeGreaterThan(0);
    expect(
      actSendReminder(ctx(store, 'owner'), { invoiceId: first.id }).ok,
    ).toBe(true);
    const after = overdueList(
      store.getState().data,
      store.getState().ops,
      TODAY,
      new Date('2026-10-24T05:00:00.000Z'),
    );
    expect(after.find((r) => r.id === first.id)?.reminders).toHaveLength(1);
  });

  it('an announcement appears in the tenant messages for its building', async () => {
    const store = await readyStore();
    const building = store.getState().data.building[0]!;
    const posted = actPostAnnouncement(ctx(store, 'owner'), {
      buildingId: building.id,
      titleTh: 'ประกาศ',
      titleEn: 'Water off Friday',
      bodyTh: 'น้ำจะดับ',
      bodyEn: 'Water off from 9 to noon',
    });
    expect(posted.ok).toBe(true);
    const titles = tenantMessages(
      store.getState().data,
      TODAY,
      store.getState().ops,
    )
      .filter((m) => m.kind === 'announcement')
      .map((m) => (m.kind === 'announcement' ? m.titleEn : ''));
    expect(titles).toContain('Water off Friday');
  });

  it('maintenance shows the room as maintenance; a notice ends an active contract only once', async () => {
    const store = await readyStore();
    const room = liveRoom(store);
    expect(
      actSetMaintenance(ctx(store, 'owner'), {
        roomId: room.id,
        maintenance: true,
      }).ok,
    ).toBe(true);
    const row = roomMap(store.getState().data, room.buildingId, TODAY).find(
      (r) => r.roomId === room.id,
    )!;
    expect(row.status).toBe('maintenance');
    expect(
      actSetMaintenance(ctx(store, 'owner'), {
        roomId: room.id,
        maintenance: false,
      }).ok,
    ).toBe(true);

    const contract = liveContractOf(store.getState().data, room.id, TODAY)!;
    expect(
      actGiveNotice(ctx(store, 'owner'), {
        contractId: contract.id,
        noticeDate: TODAY,
      }).ok,
    ).toBe(true);
    expect(
      roomDetail(store.getState().data, room.id, TODAY)?.contract?.status,
    ).toBe('notice_given');
    expect(
      actGiveNotice(ctx(store, 'owner'), {
        contractId: contract.id,
        noticeDate: TODAY,
      }),
    ).toEqual({
      ok: false,
      error: 'contracts.errors.notActive',
    });
  });
});

describe('move-in and move-out', () => {
  it('moves a renter into a vacant room with a contract, readings and the first invoice', async () => {
    const store = await readyStore();
    const data = store.getState().data;
    const vacant = data.room.find(
      (r) =>
        !r.maintenance &&
        !data.contract.some((c) => c.roomId === r.id && c.status !== 'ended'),
    )!;
    const type = data.room_type.find((t) => t.id === vacant.roomTypeId)!;
    const result = actMoveIn(ctx(store, 'owner'), {
      roomId: vacant.id,
      renter: { mode: 'new', name: 'Test Renter', phone: null },
      startDate: TODAY,
      monthlyRentSatang: type.monthlyRentSatang,
      depositSatang: type.depositSatang,
      advanceMonths: type.advanceMonths,
      occupants: 1,
      parkingSatang: 0,
      internetSatang: 0,
      elecReading: 100,
      waterReading: 10,
      checklist: CHECKLIST_KEYS.map((key) => ({ key, status: 'ok' as const })),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = store.getState().data;
    expect(
      after.contract.find((c) => c.id === result.value.contractId),
    ).toMatchObject({ status: 'active' });
    expect(
      after.invoice.find((i) => i.number === result.value.invoiceNumber),
    ).toMatchObject({ type: 'move_in', status: 'sent' });
    expect(
      after.invoice.find((i) => i.number === result.value.invoiceNumber)!
        .totalSatang,
    ).toBe(result.value.total);
    expect(roomDetail(after, vacant.id, TODAY)?.status).toBe('occupied');
    expect(
      actMoveIn(ctx(store, 'owner'), {
        roomId: vacant.id,
        renter: { mode: 'new', name: 'Second', phone: null },
        startDate: TODAY,
        monthlyRentSatang: type.monthlyRentSatang,
        depositSatang: 0,
        advanceMonths: 0,
        occupants: 1,
        parkingSatang: 0,
        internetSatang: 0,
        elecReading: 1,
        waterReading: 1,
        checklist: [],
      }),
    ).toEqual({ ok: false, error: 'contracts.errors.roomNotVacant' });
  });

  it('settles a move-out from the final readings and ends the contract once', async () => {
    const store = await readyStore();
    const room = liveRoom(store);
    const contract = liveContractOf(store.getState().data, room.id, TODAY)!;
    const lastElec = readingHistory(
      store.getState().data,
      room.id,
      'electricity',
    )
      .filter((h) => h.period < '2026-10')
      .sort((a, b) => a.period.localeCompare(b.period))
      .at(-1)!;
    const lastWater = readingHistory(store.getState().data, room.id, 'water')
      .filter((h) => h.period < '2026-10')
      .sort((a, b) => a.period.localeCompare(b.period))
      .at(-1)!;
    const input = {
      contractId: contract.id,
      moveOutDate: TODAY,
      elecReading: lastElec.reading + 10,
      waterReading: lastWater.reading + 2,
      elecRollover: false,
      waterRollover: false,
      damages: 0,
      cleaningFee: 0,
      checklist: CHECKLIST_KEYS.map((key) => ({ key, status: null })),
    };
    expect(
      moveOutPreview(store.getState().data, input)?.result.refund,
    ).toBeTypeOf('number');
    const done = actMoveOut(ctx(store, 'owner'), input);
    expect(done.ok).toBe(true);
    expect(
      store.getState().data.contract.find((c) => c.id === contract.id)?.status,
    ).toBe('ended');
    expect(
      store
        .getState()
        .data.settlement.some((s) => s.contractId === contract.id),
    ).toBe(true);
    expect(actMoveOut(ctx(store, 'owner'), input)).toEqual({
      ok: false,
      error: 'contracts.errors.notActive',
    });
  });
});
