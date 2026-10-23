import { ActionError, getDemoTenant } from '@peera/db';
import { createTestDb, type TestDb } from '@peera/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadContractDetail, loadContracts, loadMoveOutContext, loadRenters } from './queries/contracts';
import { loadProperty } from './queries/property';
import { demoApp } from './demo-app';
import { rentrollMigrations } from './migrations';
import { bangkokDate, dayNumber, isoFromDayNumber } from '../domain/dates';
import { moveInInvoice } from '../domain/move';
import { ratePlanOn } from '../domain/property';
import { buildSeed } from './seed/generator';
import { insertSeed } from './seed/insert';
import { giveNotice, moveIn, moveOut, prepareMoveOut, type MoveInInput } from './writes/contracts';

let testDb: TestDb;
let tenantId: string;
const today = () => bangkokDate(new Date());

beforeAll(async () => {
  testDb = await createTestDb([rentrollMigrations]);
  const data = buildSeed();
  await testDb.db.transaction((tx) => insertSeed(tx, data));
  ({ tenantId } = await getDemoTenant(testDb.db, demoApp, { sid: crypto.randomUUID(), variant: 'apartment' }));
});

afterAll(async () => {
  await testDb?.cleanup();
});

async function vacantRoom() {
  const { rooms } = await loadProperty(testDb.db, tenantId, today());
  const room = rooms.find((r) => r.status === 'vacant');
  if (!room) throw new Error('the seed should leave vacant rooms');
  return room;
}

function moveInFor(roomId: string, overrides: Partial<MoveInInput> = {}): MoveInInput {
  return {
    roomId,
    renter: { mode: 'new', name: 'สมศรี ทดสอบ', phone: '+66812345678', emergencyContact: null },
    startDate: today(),
    monthlyRentSatang: 1500000,
    depositSatang: 3000000,
    advanceMonths: 1,
    occupants: 1,
    parkingSatang: 0,
    internetSatang: 0,
    elecReading: 1000,
    waterReading: 50,
    checklist: [{ key: 'walls', status: 'ok' }],
    note: null,
    ...overrides,
  };
}

async function roomStatusOf(roomId: string) {
  const { rooms } = await loadProperty(testDb.db, tenantId, today());
  return rooms.find((r) => r.id === roomId)!.status;
}

describe('move-in', () => {
  it('creates the contract, starting meters, checklist and first invoice, and the room is occupied', async () => {
    const room = await vacantRoom();
    const input = moveInFor(room.id);
    const result = await testDb.db.transaction((tx) => moveIn(tx, tenantId, input));

    const expected = moveInInvoice({
      monthlyRent: input.monthlyRentSatang,
      startDate: input.startDate,
      period: input.startDate.slice(0, 7),
      deposit: input.depositSatang,
      advanceMonths: input.advanceMonths,
    });
    expect(result.total).toBe(expected.total);
    expect(result.invoiceNumber).toMatch(/^INV-\d{4}-\d{2}-\d{4}$/);
    expect(await roomStatusOf(room.id)).toBe('occupied');

    const detail = await loadContractDetail(testDb.db, tenantId, result.contractId, today());
    expect(detail!.status).toBe('occupied');
    expect(detail!.renters).toHaveLength(1);
    expect(detail!.renters[0]!.isPrimary).toBe(true);
    expect(detail!.checklists.map((c) => c.kind)).toEqual(['move_in']);
    expect(detail!.invoices.map((i) => [i.type, i.totalSatang])).toEqual([['move_in', expected.total]]);
  });

  it('refuses a second move-in into the same room', async () => {
    const room = await vacantRoom().catch(() => null);
    const occupied = (await loadProperty(testDb.db, tenantId, today())).rooms.find((r) => r.status === 'occupied')!;
    expect(room).toBeDefined();
    const attempt = testDb.db.transaction((tx) => moveIn(tx, tenantId, moveInFor(occupied.id)));
    await expect(attempt).rejects.toMatchObject({ code: 'contract.room_not_vacant' });
    await expect(attempt).rejects.toBeInstanceOf(ActionError);
  });

  it('numbers invoices one after another, with no gaps', async () => {
    const rooms = (await loadProperty(testDb.db, tenantId, today())).rooms.filter((r) => r.status === 'vacant');
    expect(rooms.length).toBeGreaterThanOrEqual(2);
    const first = await testDb.db.transaction((tx) => moveIn(tx, tenantId, moveInFor(rooms[0]!.id)));
    const second = await testDb.db.transaction((tx) => moveIn(tx, tenantId, moveInFor(rooms[1]!.id)));
    const a = Number(first.invoiceNumber.split('-').at(-1));
    const b = Number(second.invoiceNumber.split('-').at(-1));
    expect(b).toBe(a + 1);
  });

  it('lists the new contracts and the renter', async () => {
    const contracts = await loadContracts(testDb.db, tenantId);
    expect(contracts.some((c) => c.renterName === 'สมศรี ทดสอบ')).toBe(true);
    const renters = await loadRenters(testDb.db, tenantId, today());
    expect(renters.find((r) => r.name === 'สมศรี ทดสอบ')?.roomNumber).not.toBeNull();
  });
});

describe('notice and move-out', () => {
  it('gives notice, keeps the room occupied, then settles the deposit to the domain figures', async () => {
    const room = (await loadProperty(testDb.db, tenantId, today())).rooms.find((r) => r.status === 'occupied' && r.contractId)!;
    const contractId = room.contractId!;
    await testDb.db.transaction((tx) => giveNotice(tx, tenantId, { contractId, noticeDate: today() }));
    expect(await roomStatusOf(room.id)).toBe('occupied');
    const detail = await loadContractDetail(testDb.db, tenantId, contractId, today());
    expect(detail!.contract.status).toBe('notice_given');

    const moveOutDate = isoFromDayNumber(dayNumber(today()) + 30);
    // Final readings are the last ones on file plus the units used, so the test does not depend on seed values.
    const last = await loadMoveOutContext(testDb.db, tenantId, contractId, moveOutDate);
    const checklist = [{ key: 'walls', status: 'damaged' as const }];
    const input = {
      contractId,
      moveOutDate,
      elecReading: last!.lastElectricity!.reading + 40,
      waterReading: last!.lastWater!.reading + 3,
      elecRollover: false,
      waterRollover: false,
      checklist,
      damages: 120000,
      cleaningFee: 50000,
    };

    const preview = await prepareMoveOut(testDb.db, tenantId, input);
    expect(ratePlanOn(last!.plan ? [last!.plan] : [], moveOutDate)).not.toBeNull();
    expect(preview.result.units).toEqual({ electricity: 40, water: 3 });

    // The unpaid balance is the move-in rent and advance (the deposit is held, not owed), so it is deducted here.
    const deposit = preview.ctx.contract.depositReceivedSatang;
    const unpaid = preview.ctx.unpaid;
    expect(unpaid).toBe(preview.result.deductions.find((d) => d.kind === 'unpaid')!.amount);
    expect(preview.result.refund).toBe(
      deposit - unpaid - preview.result.utilities.electricity - preview.result.utilities.water - 120000 - 50000,
    );

    const committed = await testDb.db.transaction((tx) => moveOut(tx, tenantId, input));
    expect(committed.refund).toBe(preview.result.refund);

    const after = await loadContractDetail(testDb.db, tenantId, contractId, today());
    expect(after!.contract.status).toBe('ended');
    expect(after!.contract.endDate).toBe(moveOutDate);
    expect(after!.settlement?.refundSatang).toBe(preview.result.refund);
    // The seed does not write move-in checklists for its tenants, so only the move-out one is expected here.
    expect(after!.checklists.map((c) => c.kind)).toContain('move_out');
    expect(await roomStatusOf(room.id)).toBe('vacant');
  });

  it('refuses a second move-out for an ended contract', async () => {
    const ended = (await loadContracts(testDb.db, tenantId)).find((c) => c.status === 'ended')!;
    const attempt = testDb.db.transaction((tx) =>
      moveOut(tx, tenantId, {
        contractId: ended.id,
        moveOutDate: today(),
        elecReading: 2000,
        waterReading: 100,
        elecRollover: false,
        waterRollover: false,
        checklist: [],
        damages: 0,
        cleaningFee: 0,
      }),
    );
    await expect(attempt).rejects.toMatchObject({ code: 'contract.not_active' });
  });
});
