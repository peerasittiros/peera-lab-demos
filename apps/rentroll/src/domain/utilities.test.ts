import { describe, expect, it } from 'vitest';
import { readingAnomaly } from './anomaly';
import { electricityAmount, unitsUsed, waterAmount } from './utilities';

describe('unitsUsed', () => {
  it('subtracts the previous reading', () => {
    expect(
      unitsUsed({
        previous: 1200,
        current: 1275,
        meterDigits: 5,
        rollover: false,
      }),
    ).toBe(75);
  });

  it('wraps at 10^digits only when the owner confirmed a rollover', () => {
    expect(
      unitsUsed({
        previous: 99980,
        current: 20,
        meterDigits: 5,
        rollover: true,
      }),
    ).toBe(40);
    expect(() =>
      unitsUsed({
        previous: 99980,
        current: 20,
        meterDigits: 5,
        rollover: false,
      }),
    ).toThrow(RangeError);
  });

  it('rejects readings with more digits than the meter has', () => {
    expect(() =>
      unitsUsed({
        previous: 0,
        current: 10000,
        meterDigits: 4,
        rollover: false,
      }),
    ).toThrow(RangeError);
  });

  it('rejects non-integer readings', () => {
    expect(() =>
      unitsUsed({
        previous: 1.5,
        current: 10,
        meterDigits: 5,
        rollover: false,
      }),
    ).toThrow(RangeError);
  });
});

describe('electricityAmount', () => {
  const rate = { ratePerUnit: 760, minCharge: 15000 };

  it('charges units × rate when that is above the minimum', () => {
    expect(electricityAmount(100, rate)).toBe(76000);
  });

  it('applies the minimum charge on low usage', () => {
    expect(electricityAmount(3, rate)).toBe(15000);
    expect(electricityAmount(0, rate)).toBe(15000);
  });
});

describe('waterAmount', () => {
  it('per unit, with a minimum', () => {
    const rate = {
      mode: 'per_unit' as const,
      ratePerUnit: 1800,
      minCharge: 15000,
    };
    expect(waterAmount(5, 1, rate)).toBe(15000);
    expect(waterAmount(20, 1, rate)).toBe(36000);
  });

  it('per person is a flat amount × occupants, regardless of units', () => {
    const rate = { mode: 'per_person' as const, perPerson: 10000 };
    expect(waterAmount(0, 2, rate)).toBe(20000);
    expect(waterAmount(999, 3, rate)).toBe(30000);
  });
});

describe('readingAnomaly', () => {
  it('flags a reading lower than the previous one first', () => {
    expect(
      readingAnomaly({ current: 10, previous: 20, units: 0, averageUnits: 50 }),
    ).toBe('lower_than_previous');
  });

  it('flags usage above twice the three-month average', () => {
    expect(
      readingAnomaly({
        current: 221,
        previous: 100,
        units: 121,
        averageUnits: 50,
      }),
    ).toBe('above_double_average');
  });

  it('flags usage below a fifth of the average', () => {
    expect(
      readingAnomaly({
        current: 109,
        previous: 100,
        units: 9,
        averageUnits: 50,
      }),
    ).toBe('below_fifth_of_average');
  });

  it('is quiet inside the band, and with no history it only checks the lower reading', () => {
    expect(
      readingAnomaly({
        current: 150,
        previous: 100,
        units: 50,
        averageUnits: 50,
      }),
    ).toBeNull();
    expect(
      readingAnomaly({
        current: 150,
        previous: 100,
        units: 50,
        averageUnits: null,
      }),
    ).toBeNull();
  });
});
