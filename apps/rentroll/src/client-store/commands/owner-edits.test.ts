import { describe, expect, it } from 'vitest';
import { ratePlanOn } from '@/src/domain/property';
import { memoryPersistence } from '../idb';
import { createStore, type Store } from '../store';
import { snapshotFor } from '../testing';
import type { Role } from '../schema';
import { balanceOf } from '../settlement';
import type { CommandContext } from './payments';
import { actIssueCreditNote } from './billing';
import { actAddRatePlan, actUpdateBuilding } from './property';

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
  now: () => new Date('2026-10-24T05:00:00.000Z'), // 12:00 in Bangkok
});

function sentInvoice(store: Store) {
  return store.getState().data.invoice.find((i) => i.status === 'sent')!;
}

describe('actIssueCreditNote', () => {
  it('takes part of the balance off a sent invoice and keeps the invoice as it was', async () => {
    const store = await readyStore();
    const invoice = sentInvoice(store);
    const before = balanceOf(store.getState().data, invoice);
    const result = actIssueCreditNote(ctx(store, 'owner'), {
      invoiceId: invoice.id,
      amountSatang: 10000,
      reason: 'Water meter error',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.number).toBe(`CN-${invoice.number}-1`);
    const data = store.getState().data;
    expect(balanceOf(data, invoice)).toBe(before - 10000);
    const after = data.invoice.find((i) => i.id === invoice.id)!;
    expect(after.totalSatang).toBe(invoice.totalSatang);
    expect(after.status).toBe('sent');
  });

  it('numbers the second note for the same invoice as -2', async () => {
    const store = await readyStore();
    const invoice = sentInvoice(store);
    actIssueCreditNote(ctx(store, 'owner'), {
      invoiceId: invoice.id,
      amountSatang: 100,
      reason: 'First',
    });
    const second = actIssueCreditNote(ctx(store, 'owner'), {
      invoiceId: invoice.id,
      amountSatang: 100,
      reason: 'Second',
    });
    expect(second).toMatchObject({
      ok: true,
      value: { number: `CN-${invoice.number}-2` },
    });
  });

  it('refuses more than the balance owed', async () => {
    const store = await readyStore();
    const invoice = sentInvoice(store);
    const owed = balanceOf(store.getState().data, invoice);
    expect(
      actIssueCreditNote(ctx(store, 'owner'), {
        invoiceId: invoice.id,
        amountSatang: owed + 1,
        reason: 'Too much',
      }),
    ).toEqual({ ok: false, error: 'billing.errors.creditOverBalance' });
  });

  it('marks the invoice paid when the credit covers the whole balance', async () => {
    const store = await readyStore();
    const invoice = sentInvoice(store);
    const owed = balanceOf(store.getState().data, invoice);
    const result = actIssueCreditNote(ctx(store, 'owner'), {
      invoiceId: invoice.id,
      amountSatang: owed,
      reason: 'Cancelled',
    });
    expect(result.ok).toBe(true);
    const after = store
      .getState()
      .data.invoice.find((i) => i.id === invoice.id)!;
    expect(after.status).toBe('paid');
    expect(balanceOf(store.getState().data, after)).toBe(0);
  });

  it('is owner only', async () => {
    const store = await readyStore();
    const invoice = sentInvoice(store);
    expect(
      actIssueCreditNote(ctx(store, 'caretaker'), {
        invoiceId: invoice.id,
        amountSatang: 100,
        reason: 'Nope',
      }),
    ).toEqual({ ok: false, error: 'errors.forbidden' });
  });
});

describe('actUpdateBuilding', () => {
  it('saves new names, PromptPay ID and days', async () => {
    const store = await readyStore();
    const building = store.getState().data.building[0]!;
    const result = actUpdateBuilding(ctx(store, 'owner'), {
      buildingId: building.id,
      nameTh: 'อาคารทดสอบ',
      nameEn: 'Test building',
      promptpayId: '0800000000',
      billingDay: 20,
      dueDay: 10,
    });
    expect(result.ok).toBe(true);
    expect(
      store.getState().data.building.find((b) => b.id === building.id),
    ).toMatchObject({
      nameTh: 'อาคารทดสอบ',
      nameEn: 'Test building',
      promptpayId: '0800000000',
      billingDay: 20,
      dueDay: 10,
    });
  });

  it('refuses a billing day outside 1 to 28', async () => {
    const store = await readyStore();
    const building = store.getState().data.building[0]!;
    expect(
      actUpdateBuilding(ctx(store, 'owner'), {
        buildingId: building.id,
        nameTh: 'อาคาร',
        nameEn: null,
        promptpayId: '0800000000',
        billingDay: 30,
        dueDay: 5,
      }),
    ).toEqual({ ok: false, error: 'property.errors.invalid' });
  });
});

describe('actAddRatePlan', () => {
  const plan = (buildingId: string, validFrom: string) => ({
    buildingId,
    validFrom,
    elecRateSatang: 800,
    elecMinSatang: 0,
    waterMode: 'per_unit' as const,
    waterRateSatang: 2000,
    waterMinSatang: 0,
    waterPerPersonSatang: 0,
    commonFeeSatang: 15000,
  });

  it('adds a plan from a future date, which applies only from that day', async () => {
    const store = await readyStore();
    const buildingId = store.getState().data.building[0]!.id;
    const result = actAddRatePlan(
      ctx(store, 'owner'),
      plan(buildingId, '2026-12-01'),
    );
    expect(result.ok).toBe(true);
    const plans = store
      .getState()
      .data.rate_plan.filter((p) => p.buildingId === buildingId);
    expect(ratePlanOn(plans, '2026-11-30')?.validFrom).not.toBe('2026-12-01');
    expect(ratePlanOn(plans, '2026-12-01')?.elecRateSatang).toBe(800);
  });

  it('refuses a date before today', async () => {
    const store = await readyStore();
    const buildingId = store.getState().data.building[0]!.id;
    expect(
      actAddRatePlan(ctx(store, 'owner'), plan(buildingId, '2026-10-01')),
    ).toEqual({ ok: false, error: 'property.errors.pastDate' });
  });

  it('refuses a second plan on a date that already has one', async () => {
    const store = await readyStore();
    const buildingId = store.getState().data.building[0]!.id;
    expect(
      actAddRatePlan(ctx(store, 'owner'), plan(buildingId, '2026-12-01')).ok,
    ).toBe(true);
    expect(
      actAddRatePlan(ctx(store, 'owner'), plan(buildingId, '2026-12-01')),
    ).toEqual({ ok: false, error: 'property.errors.ratePlanDuplicate' });
  });
});
