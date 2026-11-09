import { describe, expect, it } from 'vitest';
import { amountFor, unitsFor } from './meter-entry';

const row = { previous: 2478, digits: 4 };
const rates = {
  elecRateSatang: 800,
  elecMinSatang: 5000,
  waterMode: 'per_unit',
  waterRateSatang: 1800,
  waterMinSatang: 10000,
};

describe('meter round live figures', () => {
  it('counts units from the previous reading', () => {
    expect(unitsFor(row, '2612', false)).toBe(134);
    expect(unitsFor(row, '2478', false)).toBe(0);
  });

  it('has no figure for an empty, non-numeric or unconfirmed lower reading', () => {
    expect(unitsFor(row, '', false)).toBeNull();
    expect(unitsFor(row, '12a', false)).toBeNull();
    expect(unitsFor(row, '0012', false)).toBeNull();
    expect(unitsFor({ previous: null, digits: 4 }, '12', false)).toBeNull();
  });

  it('counts past the last digit when a rollover is confirmed', () => {
    expect(unitsFor({ previous: 9990, digits: 4 }, '0012', true)).toBe(22);
  });

  it('prices units at the rate with the minimum, and not per-person water', () => {
    expect(amountFor(rates, 'electricity', 134)).toBe(107200);
    expect(amountFor(rates, 'electricity', 2)).toBe(5000);
    expect(amountFor(rates, 'water', 10)).toBe(18000);
    expect(amountFor({ ...rates, waterMode: 'per_person' }, 'water', 10)).toBeNull();
    expect(amountFor(null, 'electricity', 10)).toBeNull();
  });
});
