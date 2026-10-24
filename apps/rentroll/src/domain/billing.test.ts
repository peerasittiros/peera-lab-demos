import { describe, expect, it } from 'vitest';
import { addMonths } from './dates';
import { monthlyInvoice, type MonthlyInput } from './billing';
import { crc16Ccitt, promptPayPayload } from './promptpay';

const base: MonthlyInput = {
  period: '2026-10',
  contract: {
    startDate: '2025-01-01',
    endDate: null,
    monthlyRent: 1500000,
    occupants: 2,
    parking: 0,
    internet: 0,
  },
  plan: {
    elec: { ratePerUnit: 760, minCharge: 15000 },
    water: { mode: 'per_person', perPerson: 10000 },
    commonFee: 30000,
    lateFee: { mode: 'per_day', amount: 5000, cap: 50000 },
  },
  electricity: { units: 100, estimate: false },
  water: { units: 0, estimate: false },
  previousBalance: 0,
  overdue: [],
  repairCharges: [],
  asOf: new Date('2026-10-25T03:00:00Z'),
};

describe('addMonths', () => {
  it('moves across year ends', () => {
    expect(addMonths('2026-10', 1)).toBe('2026-11');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});

describe('monthlyInvoice', () => {
  it('bills a full month: rent, electricity, water per person, common fee', () => {
    const invoice = monthlyInvoice(base)!;
    expect(invoice.lines.map((l) => [l.key, l.amount])).toEqual([
      ['rent', 1500000],
      ['electricity', 76000],
      ['water', 20000],
      ['common', 30000],
    ]);
    expect(invoice.total).toBe(1500000 + 76000 + 20000 + 30000);
  });

  it('prorates the rent for a move-out in the middle of the month, and bills nothing outside the contract', () => {
    const moving = monthlyInvoice({
      ...base,
      contract: { ...base.contract, endDate: '2026-10-10' },
    })!;
    // 10 of 31 days: 15,000 × 10 / 31 = 4,838.71 baht, rounded to 4,839.
    expect(moving.lines[0]).toMatchObject({ key: 'rent', amount: 483900 });
    expect(
      monthlyInvoice({
        ...base,
        contract: { ...base.contract, endDate: '2026-09-30' },
      }),
    ).toBeNull();
  });

  it('flags estimated readings on the line', () => {
    const invoice = monthlyInvoice({
      ...base,
      electricity: { units: 90, estimate: true },
    })!;
    expect(invoice.lines[1]!.meta).toEqual({ units: 90, estimate: true });
  });

  it('charges a late fee once per overdue invoice, and skips the ones already charged', () => {
    const overdue = [
      {
        id: 'a',
        dueDate: '2026-10-05',
        outstanding: 1500000,
        alreadyCharged: false,
      },
      {
        id: 'b',
        dueDate: '2026-09-05',
        outstanding: 1500000,
        alreadyCharged: true,
      },
    ];
    const invoice = monthlyInvoice({ ...base, overdue })!;
    const fees = invoice.lines.filter((l) => l.kind === 'late_fee');
    expect(fees).toHaveLength(1);
    // 2026-10-25 is 20 days after 2026-10-05: 5,000 × 20 = 100,000, capped at 50,000.
    expect(fees[0]!.amount).toBe(50000);
    expect(fees[0]!.meta).toEqual({ forInvoice: 'a' });
  });

  it('adds the previous balance into the total', () => {
    const invoice = monthlyInvoice({ ...base, previousBalance: 250000 })!;
    expect(invoice.subtotal).toBe(1500000 + 76000 + 20000 + 30000);
    expect(invoice.total).toBe(invoice.subtotal + 250000);
  });
});

describe('repair charges', () => {
  it('adds a one-off line for each repair billed to the renter', () => {
    const invoice = monthlyInvoice({
      ...base,
      repairCharges: [{ ticketId: 't1', amount: 50000 }],
    })!;
    const line = invoice.lines.find((l) => l.kind === 'one_off')!;
    expect(line.amount).toBe(50000);
    expect(line.meta).toEqual({ ticketId: 't1', item: 'repair' });
    expect(invoice.total).toBe(1500000 + 76000 + 20000 + 30000 + 50000);
  });
});

describe('PromptPay payload', () => {
  it('matches the CRC-16/CCITT-FALSE check value', () => {
    expect(crc16Ccitt('123456789')).toBe(0x29b1);
  });

  it('encodes the amount, the target and a checksum that verifies', () => {
    const payload = promptPayPayload({
      target: { kind: 'phone', value: '0812345678' },
      amount: 15000,
    });
    expect(payload.startsWith('000201010212')).toBe(true);
    expect(payload).toContain('0066812345678');
    expect(payload).toContain('5406150.00');
    expect(payload).toContain('5303764');
    const body = payload.slice(0, -4);
    expect(payload.slice(-4)).toBe(
      crc16Ccitt(body).toString(16).toUpperCase().padStart(4, '0'),
    );
  });

  it('uses the tax-ID sub-tag for a 13-digit tax ID', () => {
    const payload = promptPayPayload({
      target: { kind: 'taxId', value: '0105555123456' },
    });
    expect(payload).toContain('02130105555123456');
    expect(payload.startsWith('000201010211')).toBe(true);
  });
});
