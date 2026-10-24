import { describe, expect, it } from 'vitest';
import { memoryPersistence } from '../idb';
import { createStore, type Store } from '../store';
import { snapshotFor } from '../testing';
import type { Role } from '../schema';
import {
  actApprovePayment,
  actRejectPayment,
  actSubmitSlip,
  type CommandContext,
} from './payments';
import { openInvoices } from '../settlement';

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

/** The contract with a sent invoice, and the amount still owed on it. */
function sentContract(store: Store) {
  const invoice = store
    .getState()
    .data.invoice.find((i) => i.status === 'sent')!;
  const owed = openInvoices(store.getState().data, invoice.contractId).reduce(
    (sum, i) => sum + i.outstanding,
    0,
  );
  return { contractId: invoice.contractId, invoiceId: invoice.id, owed };
}

describe('actSubmitSlip', () => {
  it('lets a tenant record a slip for the open balance', async () => {
    const store = await readyStore();
    const { invoiceId, owed } = sentContract(store);
    const result = actSubmitSlip(ctx(store, 'tenant'), {
      invoiceId,
      amountSatang: owed,
      slipUrl: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      store
        .getState()
        .data.payment.find((p) => p.id === result.value.paymentId),
    ).toMatchObject({
      status: 'pending_review',
      amountSatang: owed,
    });
  });

  it('refuses more than the balance, and a caretaker', async () => {
    const store = await readyStore();
    const { invoiceId, owed } = sentContract(store);
    expect(
      actSubmitSlip(ctx(store, 'tenant'), {
        invoiceId,
        amountSatang: owed + 1,
        slipUrl: null,
      }),
    ).toEqual({
      ok: false,
      error: 'payments.errors.exceedsBalance',
    });
    expect(
      actSubmitSlip(ctx(store, 'caretaker'), {
        invoiceId,
        amountSatang: 1,
        slipUrl: null,
      }),
    ).toEqual({
      ok: false,
      error: 'errors.forbidden',
    });
  });
});

describe('actApprovePayment and actRejectPayment', () => {
  it('approves a slip: the receipt number, the invoice and the balance all move', async () => {
    const store = await readyStore();
    const { invoiceId, contractId, owed } = sentContract(store);
    const slip = actSubmitSlip(ctx(store, 'tenant'), {
      invoiceId,
      amountSatang: owed,
      slipUrl: null,
    });
    if (!slip.ok) throw new Error('slip failed');

    const approved = actApprovePayment(ctx(store, 'owner'), {
      paymentId: slip.value.paymentId,
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    // Buddhist-era year (2569), October, the first receipt of the building this month.
    expect(approved.value.receiptNumber).toMatch(/^RCT-2569-10-\d{4}$/);
    expect(openInvoices(store.getState().data, contractId)).toEqual([]);
    expect(
      store.getState().data.payment.find((p) => p.id === slip.value.paymentId),
    ).toMatchObject({
      status: 'approved',
      receiptNumber: approved.value.receiptNumber,
    });
  });

  it('only the owner approves or rejects', async () => {
    const store = await readyStore();
    const { invoiceId, owed } = sentContract(store);
    const slip = actSubmitSlip(ctx(store, 'tenant'), {
      invoiceId,
      amountSatang: owed,
      slipUrl: null,
    });
    if (!slip.ok) throw new Error('slip failed');
    expect(
      actApprovePayment(ctx(store, 'tenant'), {
        paymentId: slip.value.paymentId,
      }),
    ).toEqual({
      ok: false,
      error: 'errors.forbidden',
    });
    expect(
      actRejectPayment(ctx(store, 'caretaker'), {
        paymentId: slip.value.paymentId,
        reason: 'no',
      }),
    ).toEqual({
      ok: false,
      error: 'errors.forbidden',
    });
  });

  it('rejects a slip with a reason, and it cannot be decided twice', async () => {
    const store = await readyStore();
    const { invoiceId, owed } = sentContract(store);
    const slip = actSubmitSlip(ctx(store, 'tenant'), {
      invoiceId,
      amountSatang: owed,
      slipUrl: null,
    });
    if (!slip.ok) throw new Error('slip failed');
    expect(
      actRejectPayment(ctx(store, 'owner'), {
        paymentId: slip.value.paymentId,
        reason: 'amount wrong',
      }).ok,
    ).toBe(true);
    expect(
      actApprovePayment(ctx(store, 'owner'), {
        paymentId: slip.value.paymentId,
      }),
    ).toEqual({
      ok: false,
      error: 'payments.errors.notPending',
    });
  });
});
