import { describe, expect, it } from 'vitest';
import {
  checkNegativeStock,
  itemStatus,
  movingAverageCost,
  roundUpToPack,
  signedQuantity,
  splitIntoPacks,
  stockValue,
  suggestReorderQty,
  toBase,
} from './stock';

describe('toBase (pack-unit entry)', () => {
  it('multiplies by the pack factor', () => {
    expect(toBase(2, 24)).toBe(48);
    expect(toBase(1, 1)).toBe(1);
    expect(toBase(3, 6)).toBe(18);
  });

  it('accepts decimals and rounds to a whole base unit', () => {
    expect(toBase(1.5, 1000)).toBe(1500);
    expect(toBase(0.25, 6)).toBe(2); // 1.5 → 2, half away from zero
    expect(toBase(0.333, 24)).toBe(8); // 7.992
    expect(toBase(0.1 + 0.2, 10)).toBe(3); // float noise doesn't leak
  });

  it('keeps the sign for adjustments', () => {
    expect(toBase(-2, 12)).toBe(-24);
    expect(toBase(-0.25, 6)).toBe(-2);
  });

  it('rejects a bad factor', () => {
    expect(() => toBase(1, 0)).toThrow(RangeError);
    expect(() => toBase(1, 1.5)).toThrow(RangeError);
    expect(() => toBase(Number.NaN, 1)).toThrow(RangeError);
  });
});

describe('packs', () => {
  it('splits base units into packs and the rest', () => {
    expect(splitIntoPacks(50, 24)).toEqual({ packs: 2, rest: 2 });
    expect(splitIntoPacks(-30, 12)).toEqual({ packs: -2, rest: -6 });
  });

  it('rounds up to whole packs', () => {
    expect(roundUpToPack(25, 24)).toBe(48);
    expect(roundUpToPack(24, 24)).toBe(24);
    expect(roundUpToPack(0, 24)).toBe(0);
    expect(roundUpToPack(7.2, 1)).toBe(8);
  });
});

describe('itemStatus', () => {
  it('is out at or below zero', () => {
    expect(itemStatus(0, 10)).toBe('out');
    expect(itemStatus(-3, 10)).toBe('out');
  });

  it('is low at or below min by default', () => {
    expect(itemStatus(10, 10)).toBe('low');
    expect(itemStatus(11, 10)).toBe('ok');
  });

  it('is low only under min with the below_min rule', () => {
    expect(itemStatus(10, 10, 'below_min')).toBe('ok');
    expect(itemStatus(9, 10, 'below_min')).toBe('low');
  });

  it('treats min 0 as never low while stock is positive', () => {
    expect(itemStatus(1, 0)).toBe('ok');
  });
});

describe('suggestReorderQty', () => {
  it('uses min × 2 − on hand when that is larger than the reorder quantity', () => {
    expect(
      suggestReorderQty({
        onHand: 2,
        minQty: 20,
        reorderQty: 12,
        packFactor: 1,
      }),
    ).toBe(38);
  });

  it('uses the reorder quantity when that is larger', () => {
    expect(
      suggestReorderQty({
        onHand: 18,
        minQty: 20,
        reorderQty: 48,
        packFactor: 1,
      }),
    ).toBe(48);
  });

  it('rounds up to the pack size', () => {
    // max(12, 40 − 5) = 35 → two cases of 24
    expect(
      suggestReorderQty({
        onHand: 5,
        minQty: 20,
        reorderQty: 12,
        packFactor: 24,
      }),
    ).toBe(48);
  });

  it('counts negative stock as a bigger need', () => {
    expect(
      suggestReorderQty({
        onHand: -4,
        minQty: 10,
        reorderQty: 6,
        packFactor: 6,
      }),
    ).toBe(24);
  });

  it('suggests at least one pack', () => {
    expect(
      suggestReorderQty({
        onHand: 50,
        minQty: 0,
        reorderQty: 0,
        packFactor: 12,
      }),
    ).toBe(12);
    expect(suggestReorderQty({ onHand: 50, minQty: 0, reorderQty: 0 })).toBe(1);
  });
});

describe('movement rules', () => {
  it('signs quantities by type', () => {
    expect(signedQuantity('in', 5)).toBe(5);
    expect(signedQuantity('out', 5)).toBe(-5);
    expect(signedQuantity('adjust', -5)).toBe(-5);
    expect(signedQuantity('adjust', 5)).toBe(5);
  });

  it('warns the owner and blocks staff below zero', () => {
    expect(checkNegativeStock('owner', 3, -5)).toBe('warn');
    expect(checkNegativeStock('staff', 3, -5)).toBe('block');
    expect(checkNegativeStock('staff', 5, -5)).toBe('ok');
    expect(checkNegativeStock('staff', -2, 1)).toBe('ok');
  });
});

describe('cost', () => {
  it('moves the average cost on a costed receipt', () => {
    // 10 at 1,000 + 30 at 1,400 = 52,000 / 40 = 1,300
    expect(movingAverageCost(10, 1000, 30, 1400)).toBe(1300);
  });

  it('takes the received cost when nothing is on hand', () => {
    expect(movingAverageCost(0, 1000, 5, 1200)).toBe(1200);
    expect(movingAverageCost(-3, 1000, 5, 1200)).toBe(1200);
    expect(movingAverageCost(4, null, 5, 1200)).toBe(1200);
  });

  it('values negative stock at zero', () => {
    expect(stockValue(-2, 500)).toBe(0);
    expect(stockValue(3, 500)).toBe(1500);
    expect(stockValue(3, null)).toBe(0);
  });
});
