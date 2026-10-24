import { describe, expect, it } from 'vitest';
import { bangkokDate, daysInPeriod } from './dates';
import { lateFee, daysLate } from './late-fee';
import { daysOccupiedInPeriod, prorateRent } from './proration';

describe('Bangkok calendar dates', () => {
  it('uses UTC+7 for the calendar day', () => {
    // 2026-10-04 17:30 UTC is 2026-10-05 00:30 in Bangkok.
    expect(bangkokDate(new Date('2026-10-04T17:30:00Z'))).toBe('2026-10-05');
    expect(bangkokDate(new Date('2026-10-04T16:59:59Z'))).toBe('2026-10-04');
  });

  it('knows month lengths, including leap February', () => {
    expect(daysInPeriod('2026-10')).toBe(31);
    expect(daysInPeriod('2026-02')).toBe(28);
    expect(daysInPeriod('2028-02')).toBe(29);
  });
});

describe('daysOccupiedInPeriod', () => {
  it('counts both ends inclusive for a move-in mid month', () => {
    expect(daysOccupiedInPeriod('2026-10', '2026-10-21', null)).toBe(11);
  });

  it('is the whole month for a contract that started earlier and is open-ended', () => {
    expect(daysOccupiedInPeriod('2026-10', '2026-01-01', null)).toBe(31);
  });

  it('stops at the move-out date', () => {
    expect(daysOccupiedInPeriod('2026-10', '2026-01-01', '2026-10-10')).toBe(
      10,
    );
  });

  it('is zero outside the period', () => {
    expect(daysOccupiedInPeriod('2026-10', '2026-11-01', null)).toBe(0);
    expect(daysOccupiedInPeriod('2026-10', '2026-01-01', '2026-09-30')).toBe(0);
  });
});

describe('prorateRent', () => {
  it('prorates rent × days / days-in-month, rounded to whole baht', () => {
    // 15,000 × 11 / 31 = 5,322.58… baht → 5,323
    expect(
      prorateRent({
        monthlyRent: 1500000,
        period: '2026-10',
        daysOccupied: 11,
        mode: 'prorate',
      }),
    ).toBe(532300);
  });

  it('charges the full month when the setting says so', () => {
    expect(
      prorateRent({
        monthlyRent: 1500000,
        period: '2026-10',
        daysOccupied: 11,
        mode: 'full_month',
      }),
    ).toBe(1500000);
  });

  it('charges the full rent for a whole month even in prorate mode', () => {
    expect(
      prorateRent({
        monthlyRent: 1500000,
        period: '2026-10',
        daysOccupied: 31,
        mode: 'prorate',
      }),
    ).toBe(1500000);
  });
});

describe('lateFee', () => {
  const due = '2026-10-05';

  it('is zero on the due day, even at 23:59 Bangkok time', () => {
    expect(daysLate(due, new Date('2026-10-05T16:59:00Z'))).toBe(0);
    expect(
      lateFee(
        { mode: 'per_day', amount: 5000, cap: 50000 },
        due,
        new Date('2026-10-05T16:59:00Z'),
      ),
    ).toBe(0);
  });

  it('counts the first minute after the due day as day 1', () => {
    expect(daysLate(due, new Date('2026-10-05T17:00:00Z'))).toBe(1);
  });

  it('charges per day late, up to the cap', () => {
    const rule = { mode: 'per_day' as const, amount: 5000, cap: 50000 };
    expect(lateFee(rule, due, new Date('2026-10-08T03:00:00Z'))).toBe(15000);
    expect(lateFee(rule, due, new Date('2026-11-30T03:00:00Z'))).toBe(50000);
  });

  it('charges a flat amount once, and the cap still applies', () => {
    expect(
      lateFee(
        { mode: 'once', amount: 20000, cap: 20000 },
        due,
        new Date('2026-10-20T03:00:00Z'),
      ),
    ).toBe(20000);
    expect(
      lateFee(
        { mode: 'once', amount: 20000, cap: 10000 },
        due,
        new Date('2026-10-20T03:00:00Z'),
      ),
    ).toBe(10000);
  });
});
