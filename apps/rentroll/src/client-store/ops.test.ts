import { describe, expect, it } from 'vitest';
import { apply, canApply, type Op } from './ops';
import type { Data } from './schema';
import { fromSnapshot, replay } from './store';
import { snapshotFor } from './testing';

const TODAY = '2026-10-24';
const data = (): Data => fromSnapshot(snapshotFor(TODAY));

/** A slip against the first sent invoice, paying `amount`. */
function slip(d: Data, id: string, amount: number): Op {
  const invoice = d.invoice.find((i) => i.status === 'sent')!;
  return {
    id,
    at: `${TODAY}T10:00:00.000Z`,
    role: 'tenant',
    kind: 'slip.submit',
    payload: {
      paymentId: `pay-${id}`,
      contractId: invoice.contractId,
      amountSatang: amount,
      slipUrl: null,
      paidAt: `${TODAY}T10:00:00.000Z`,
    },
  };
}

describe('slip.submit', () => {
  it('adds a pending payment and leaves the invoices alone', () => {
    const d = data();
    const op = slip(d, 'op-1', 100);
    expect(canApply(d, op)).toBe(true);
    const next = apply(d, op);
    expect(next.payment.find((p) => p.id === 'pay-op-1')).toMatchObject({
      status: 'pending_review',
      amountSatang: 100,
    });
    expect(next.invoice).toEqual(d.invoice);
  });

  it('does not mutate its input', () => {
    const d = data();
    const before = JSON.stringify(d);
    apply(d, slip(d, 'op-2', 100));
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe('payment.approve and payment.reject', () => {
  it('approves a pending slip: payment, allocation, invoice and receipt sequence move together', () => {
    const d = data();
    const invoice = d.invoice.find((i) => i.status === 'sent')!;
    const owed = invoice.totalSatang - invoice.paidSatang;
    const submitted = apply(d, slip(d, 'op-3', owed));
    const approve: Op = {
      id: 'op-4',
      at: `${TODAY}T11:00:00.000Z`,
      role: 'owner',
      kind: 'payment.approve',
      payload: {
        paymentId: 'pay-op-3',
        amountSatang: owed,
        reviewedBy: 'owner',
        receiptNumber: 'RCT-2569-10-0001',
        buildingId: invoice.buildingId,
        docType: 'RCT',
        year: 2026,
        sequence: 1,
        allocations: [{ invoiceId: invoice.id, amount: owed }],
      },
    };
    expect(canApply(submitted, approve)).toBe(true);
    const done = apply(submitted, approve);
    expect(done.payment.find((p) => p.id === 'pay-op-3')).toMatchObject({
      status: 'approved',
      receiptNumber: 'RCT-2569-10-0001',
    });
    expect(done.invoice.find((i) => i.id === invoice.id)).toMatchObject({
      status: 'paid',
      paidSatang: invoice.totalSatang,
    });
    expect(done.payment_allocation.at(-1)).toMatchObject({
      paymentId: 'pay-op-3',
      invoiceId: invoice.id,
    });
    const sequence = done.doc_sequence.find(
      (s) =>
        s.buildingId === invoice.buildingId &&
        s.docType === 'RCT' &&
        s.year === 2026,
    );
    expect(sequence?.nextNo).toBe(2);
    expect(canApply(done, approve)).toBe(false);
  });

  it('rejects a pending slip with a reason', () => {
    const d = data();
    const submitted = apply(d, slip(d, 'op-5', 100));
    const reject: Op = {
      id: 'op-6',
      at: `${TODAY}T11:00:00.000Z`,
      role: 'owner',
      kind: 'payment.reject',
      payload: {
        paymentId: 'pay-op-5',
        reason: 'slip unclear',
        reviewedBy: 'owner',
      },
    };
    const done = apply(submitted, reject);
    expect(done.payment.find((p) => p.id === 'pay-op-5')).toMatchObject({
      status: 'rejected',
      rejectReason: 'slip unclear',
    });
  });
});

describe('replay', () => {
  it('equals applying the ops one by one', () => {
    const base = data();
    const ops = [slip(base, 'a', 100), slip(base, 'b', 200)];
    const sequential = ops.reduce((d, op) => apply(d, op), base);
    expect(replay(base, ops).data).toEqual(sequential);
  });

  it('ignores an op whose id was already applied', () => {
    const base = data();
    const op = slip(base, 'dup', 100);
    const once = replay(base, [op]);
    const twice = replay(base, [op, op]);
    expect(twice.data).toEqual(once.data);
    expect(twice.skipped).toBe(0);
  });

  it('skips and counts an op whose rows are gone', () => {
    const base = data();
    const orphan = slip(base, 'orphan', 100);
    const missing = {
      ...orphan,
      payload: {
        ...orphan.payload,
        contractId: '00000000-0000-0000-0000-000000000000',
      },
    } as Op;
    const result = replay(base, [missing]);
    expect(result.skipped).toBe(1);
    expect(result.data.payment).toHaveLength(base.payment.length);
  });
});
