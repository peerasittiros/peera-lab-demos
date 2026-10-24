import { describe, expect, it } from 'vitest';
import { allocatePayment } from './payments';
import { applyCredit, invoiceTotals } from './invoice';
import { settleDeposit } from './deposit';
import { formatDocumentNumber, documentYear } from './numbering';
import { divRound, roundToBaht } from './money';

describe('money helpers', () => {
  it('rounds to whole baht, halves up', () => {
    expect(roundToBaht(532299)).toBe(532300);
    expect(roundToBaht(532250)).toBe(532300);
    expect(roundToBaht(532249)).toBe(532200);
  });

  it('divides with rounding to the nearest integer', () => {
    expect(divRound(10, 4)).toBe(3);
    expect(divRound(11, 4)).toBe(3);
    expect(divRound(14, 4)).toBe(4);
  });
});

describe('invoiceTotals', () => {
  it('sums the period charges as the subtotal', () => {
    const lines = [
      { kind: 'rent' as const, amount: 1500000 },
      { kind: 'electricity' as const, amount: 76000 },
      { kind: 'water' as const, amount: 15000 },
      { kind: 'extra' as const, amount: 30000 },
    ];
    expect(invoiceTotals(lines)).toEqual({ subtotal: 1621000, total: 1621000 });
  });

  it('adds the previous balance and subtracts a credit', () => {
    const lines = [
      { kind: 'rent' as const, amount: 1500000 },
      { kind: 'previous_balance' as const, amount: 50000 },
      { kind: 'late_fee' as const, amount: 15000 },
      { kind: 'credit' as const, amount: -20000 },
    ];
    expect(invoiceTotals(lines)).toEqual({ subtotal: 1515000, total: 1545000 });
  });

  it('rejects a positive credit line and a negative charge', () => {
    expect(() => invoiceTotals([{ kind: 'credit', amount: 100 }])).toThrow(
      RangeError,
    );
    expect(() => invoiceTotals([{ kind: 'rent', amount: -100 }])).toThrow(
      RangeError,
    );
  });
});

describe('applyCredit (credit carry-forward)', () => {
  it('uses the credit against the amount due and keeps the rest', () => {
    expect(applyCredit(30000, 50000)).toEqual({
      applied: 30000,
      due: 20000,
      remainingCredit: 0,
    });
  });

  it('carries unused credit forward when the bill is smaller', () => {
    expect(applyCredit(30000, 10000)).toEqual({
      applied: 10000,
      due: 0,
      remainingCredit: 20000,
    });
  });
});

describe('allocatePayment', () => {
  const invoices = [
    { id: 'b', dueDate: '2026-09-05', outstanding: 1500000 },
    { id: 'a', dueDate: '2026-08-05', outstanding: 1500000 },
    { id: 'c', dueDate: '2026-10-05', outstanding: 1500000 },
  ];

  it('pays the oldest invoice first, then the next', () => {
    const { allocations, overpayment } = allocatePayment(2000000, invoices);
    expect(allocations).toEqual([
      { invoiceId: 'a', amount: 1500000 },
      { invoiceId: 'b', amount: 500000 },
    ]);
    expect(overpayment).toBe(0);
  });

  it('a partial payment leaves the oldest invoice partly open', () => {
    expect(allocatePayment(400000, invoices).allocations).toEqual([
      { invoiceId: 'a', amount: 400000 },
    ]);
  });

  it('turns an overpayment into credit', () => {
    expect(allocatePayment(5000000, invoices).overpayment).toBe(500000);
  });

  it('skips paid invoices', () => {
    const withPaid = [
      { id: 'x', dueDate: '2026-07-05', outstanding: 0 },
      ...invoices,
    ];
    expect(allocatePayment(100, withPaid).allocations).toEqual([
      { invoiceId: 'a', amount: 100 },
    ]);
  });
});

describe('settleDeposit', () => {
  it('refunds deposit minus deductions', () => {
    const { deductions, refund } = settleDeposit({
      deposit: 1500000,
      unpaid: 0,
      finalUtilities: 45000,
      damages: 120000,
      cleaningFee: 50000,
    });
    expect(deductions.map((d) => d.kind)).toEqual([
      'unpaid',
      'final_utilities',
      'damages',
      'cleaning',
    ]);
    expect(refund).toBe(1285000);
  });

  it('returns a negative refund when the tenant owes money', () => {
    expect(
      settleDeposit({
        deposit: 1500000,
        unpaid: 1600000,
        finalUtilities: 0,
        damages: 0,
        cleaningFee: 0,
      }).refund,
    ).toBe(-100000);
  });
});

describe('formatDocumentNumber', () => {
  it('uses the Buddhist year when asked, like INV-2569-10-0001', () => {
    expect(
      formatDocumentNumber({
        prefix: 'INV',
        ceYear: 2026,
        month: 10,
        sequence: 1,
        style: 'be',
      }),
    ).toBe('INV-2569-10-0001');
  });

  it('uses the Gregorian year in CE style', () => {
    expect(documentYear(2026, 'ce')).toBe(2026);
    expect(
      formatDocumentNumber({
        prefix: 'CN',
        ceYear: 2026,
        month: 3,
        sequence: 42,
        style: 'ce',
      }),
    ).toBe('CN-2026-03-0042');
  });

  it('rejects sequences outside 1–9999', () => {
    expect(() =>
      formatDocumentNumber({
        prefix: 'INV',
        ceYear: 2026,
        month: 1,
        sequence: 0,
        style: 'ce',
      }),
    ).toThrow(RangeError);
    expect(() =>
      formatDocumentNumber({
        prefix: 'INV',
        ceYear: 2026,
        month: 1,
        sequence: 10000,
        style: 'ce',
      }),
    ).toThrow(RangeError);
  });
});
