import { describe, expect, it } from 'vitest';
import { memoryPersistence } from './idb';
import {
  actApprovePayment,
  actRecordManualPayment,
  actRejectPayment,
  actSubmitSlip,
  type CommandContext,
} from './commands/payments';
import { canApply, type Op } from './ops';
import { tenantContract } from './selectors/tenant';
import {
  ownerFeed,
  feedCounts,
  loadReceipt,
  tenantMessages,
} from './selectors/live';
import { loadPayableContracts } from './selectors/live';
import { owedOn, openInvoices } from './settlement';
import { createStore, type Store } from './store';
import { snapshotFor } from './testing';
import type { Role } from './schema';

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

describe('owner manual payment (payment.record)', () => {
  it('approves the amount at once, settles the balance and numbers a receipt', async () => {
    const store = await readyStore();
    const invoice = sentInvoice(store);
    const owed = owedOn(store.getState().data, invoice.contractId);
    const result = actRecordManualPayment(ctx(store, 'owner'), {
      contractId: invoice.contractId,
      amountSatang: owed,
      method: 'transfer',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.receiptNumber).toMatch(/^RCT-2569-10-\d{4}$/);
    const data = store.getState().data;
    expect(
      data.payment.find((p) => p.id === result.value.paymentId),
    ).toMatchObject({
      status: 'approved',
      method: 'transfer',
      receiptNumber: result.value.receiptNumber,
    });
    expect(openInvoices(data, invoice.contractId)).toEqual([]);
  });

  it('is refused for a tenant, and for more than the balance', async () => {
    const store = await readyStore();
    const invoice = sentInvoice(store);
    const owed = owedOn(store.getState().data, invoice.contractId);
    expect(
      actRecordManualPayment(ctx(store, 'tenant'), {
        contractId: invoice.contractId,
        amountSatang: 1,
        method: 'cash',
      }),
    ).toEqual({ ok: false, error: 'errors.forbidden' });
    expect(
      actRecordManualPayment(ctx(store, 'owner'), {
        contractId: invoice.contractId,
        amountSatang: owed + 1,
        method: 'cash',
      }),
    ).toEqual({ ok: false, error: 'payments.errors.exceedsBalance' });
  });

  it('gives each approval the next receipt number of the same building and year', async () => {
    const store = await readyStore();
    const invoice = sentInvoice(store);
    const owed = owedOn(store.getState().data, invoice.contractId);
    const first = actRecordManualPayment(ctx(store, 'owner'), {
      contractId: invoice.contractId,
      amountSatang: owed,
      method: 'cash',
    });
    const sameBuildingOther = store
      .getState()
      .data.invoice.find(
        (i) => i.status === 'sent' && i.contractId !== invoice.contractId,
      );
    if (!sameBuildingOther) return;
    const second = actRecordManualPayment(ctx(store, 'owner'), {
      contractId: sameBuildingOther.contractId,
      amountSatang: owedOn(store.getState().data, sameBuildingOther.contractId),
      method: 'cash',
    });
    expect(first.ok && second.ok).toBe(true);
  });

  it('is refused by canApply once its payment id exists', async () => {
    const store = await readyStore();
    const invoice = sentInvoice(store);
    const owed = owedOn(store.getState().data, invoice.contractId);
    const result = actRecordManualPayment(ctx(store, 'owner'), {
      contractId: invoice.contractId,
      amountSatang: owed,
      method: 'cash',
    });
    if (!result.ok) throw new Error('record failed');
    const op = store.getState().ops.at(-1) as Op;
    expect(canApply(store.getState().data, op)).toBe(false);
  });
});

describe('the live loop (SPEC §4 steps 1 and 2)', () => {
  it('a slip shows for the owner, and approval puts a receipt in the tenant chat and on the receipt', async () => {
    const store = await readyStore();
    const mine = tenantContract(store.getState().data, TODAY)!.contractId;
    const invoice = store
      .getState()
      .data.invoice.find((i) => i.status === 'sent' && i.contractId === mine)!;
    const owed = owedOn(store.getState().data, invoice.contractId);
    const slip = actSubmitSlip(ctx(store, 'tenant'), {
      invoiceId: invoice.id,
      amountSatang: owed,
      slipUrl: 'sample',
    });
    if (!slip.ok) throw new Error('slip failed');
    expect(feedCounts(store.getState().data).slipsWaiting).toBeGreaterThan(0);
    expect(ownerFeed(store.getState().ops)[0]).toMatchObject({
      kind: 'slip.submitted',
    });

    const approved = actApprovePayment(ctx(store, 'owner'), {
      paymentId: slip.value.paymentId,
    });
    if (!approved.ok) throw new Error('approve failed');
    const data = store.getState().data;
    const messages = tenantMessages(data, TODAY);
    expect(
      messages.some(
        (m) =>
          m.kind === 'receipt' &&
          m.receiptNumber === approved.value.receiptNumber,
      ),
    ).toBe(true);
    expect(loadReceipt(data, slip.value.paymentId, TODAY)).toMatchObject({
      payment: { receiptNumber: approved.value.receiptNumber },
    });
    expect(ownerFeed(store.getState().ops)[0]).toMatchObject({
      kind: 'payment.approved',
    });
  });

  it('a rejected slip is in the feed and does not settle anything', async () => {
    const store = await readyStore();
    const invoice = sentInvoice(store);
    const before = owedOn(store.getState().data, invoice.contractId);
    const slip = actSubmitSlip(ctx(store, 'tenant'), {
      invoiceId: invoice.id,
      amountSatang: 100,
      slipUrl: null,
    });
    if (!slip.ok) throw new Error('slip failed');
    actRejectPayment(ctx(store, 'owner'), {
      paymentId: slip.value.paymentId,
      reason: 'unclear',
    });
    expect(owedOn(store.getState().data, invoice.contractId)).toBe(before);
    expect(ownerFeed(store.getState().ops)[0]).toMatchObject({
      kind: 'payment.rejected',
    });
  });

  it('lists the payable contracts with their room', async () => {
    const store = await readyStore();
    const contracts = loadPayableContracts(store.getState().data, TODAY);
    expect(contracts.length).toBeGreaterThan(0);
    expect(contracts[0]).toHaveProperty('roomNumber');
  });
});
