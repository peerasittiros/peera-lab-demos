import { describe, expect, it } from 'vitest';
import {
  blankChecklist,
  moveInInvoice,
  moveOutSettlement,
  newDamage,
  type ChecklistItem,
} from './move';

describe('moveInInvoice', () => {
  it('prorates rent for a mid-month start, adds deposit and advance rent', () => {
    // 15,000 × 11 / 31 = 5,322.58 → 5,323 baht. Deposit 30,000. Advance 1 month = 15,000.
    const invoice = moveInInvoice({
      monthlyRent: 1500000,
      startDate: '2026-10-21',
      period: '2026-10',
      deposit: 3000000,
      advanceMonths: 1,
    });
    expect(invoice.daysOccupied).toBe(11);
    expect(invoice.lines).toEqual([
      { kind: 'rent', amount: 532300 },
      { kind: 'deposit', amount: 3000000 },
      { kind: 'advance', amount: 1500000 },
    ]);
    expect(invoice.total).toBe(532300 + 3000000 + 1500000);
    expect(invoice.subtotal).toBe(invoice.total);
  });

  it('charges the whole rent when the contract starts on the first day', () => {
    const invoice = moveInInvoice({
      monthlyRent: 1500000,
      startDate: '2026-10-01',
      period: '2026-10',
      deposit: 0,
      advanceMonths: 0,
    });
    expect(invoice.lines[0]).toEqual({ kind: 'rent', amount: 1500000 });
    expect(invoice.total).toBe(1500000);
  });
});

describe('moveOutSettlement', () => {
  const base = {
    elec: {
      previous: 1200,
      current: 1275,
      meterDigits: 5,
      rollover: false,
      rate: { ratePerUnit: 760, minCharge: 15000 },
    },
    water: {
      previous: 300,
      current: 312,
      meterDigits: 4,
      rollover: false,
      rate: { mode: 'per_unit' as const, ratePerUnit: 1800, minCharge: 15000 },
      occupants: 2,
    },
    unpaid: 0,
    deposit: 3000000,
    damages: 0,
    cleaningFee: 0,
  };

  it('prices final utilities and refunds the rest of the deposit', () => {
    const result = moveOutSettlement(base);
    // 75 units × 760 = 57,000; 12 units × 1,800 = 21,600 → 78,600 of utilities.
    expect(result.units).toEqual({ electricity: 75, water: 12 });
    expect(result.utilities).toEqual({ electricity: 57000, water: 21600 });
    expect(result.refund).toBe(3000000 - 78600);
  });

  it('deducts unpaid rent, damages and cleaning, and returns a negative refund when the tenant owes', () => {
    const result = moveOutSettlement({
      ...base,
      unpaid: 1500000,
      damages: 1200000,
      cleaningFee: 500000,
    });
    expect(result.deductions.map((d) => [d.kind, d.amount])).toEqual([
      ['unpaid', 1500000],
      ['final_utilities', 78600],
      ['damages', 1200000],
      ['cleaning', 500000],
    ]);
    expect(result.refund).toBe(3000000 - (1500000 + 78600 + 1200000 + 500000));
    expect(result.refund).toBeLessThan(0);
  });

  it('uses the per-person water rate when the building bills water that way', () => {
    const result = moveOutSettlement({
      ...base,
      water: { ...base.water, rate: { mode: 'per_person', perPerson: 10000 } },
    });
    expect(result.utilities.water).toBe(20000);
  });

  it('a lower final reading needs the rollover to be confirmed', () => {
    expect(() =>
      moveOutSettlement({
        ...base,
        elec: { ...base.elec, previous: 99980, current: 20 },
      }),
    ).toThrow(RangeError);
    const wrapped = moveOutSettlement({
      ...base,
      elec: { ...base.elec, previous: 99980, current: 20, rollover: true },
    });
    expect(wrapped.units.electricity).toBe(40);
  });
});

describe('newDamage', () => {
  const at = (
    status: ChecklistItem['status'],
    key = 'walls',
  ): ChecklistItem[] =>
    blankChecklist().map((item) =>
      item.key === key ? { ...item, status } : { ...item, status: 'ok' },
    );

  it('flags items that went from OK to damaged, and ignores ones already damaged at move-in', () => {
    expect(newDamage(at('ok'), at('damaged'))).toEqual(['walls']);
    expect(newDamage(at('damaged'), at('damaged'))).toEqual([]);
    expect(newDamage(at('ok'), at('ok'))).toEqual([]);
  });
});
