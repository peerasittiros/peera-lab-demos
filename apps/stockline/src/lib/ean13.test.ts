import { describe, expect, it } from 'vitest';
import { ean13Bars, ean13Modules, isEan13 } from './ean13';

describe('EAN-13', () => {
  it('validates the check digit', () => {
    expect(isEan13('4006381333931')).toBe(true);
    expect(isEan13('4006381333932')).toBe(false);
    expect(isEan13('12345')).toBe(false);
  });

  it('encodes the reference symbol 4006381333931', () => {
    // First digit 4 → parity LGLLGG for 0 0 6 3 8 1; right half 3 3 3 9 3 1 in the R set.
    expect(ean13Modules('4006381333931')).toBe(
      '101' +
        '0001101' +
        '0100111' +
        '0101111' +
        '0111101' +
        '0001001' +
        '0110011' +
        '01010' +
        '1000010' +
        '1000010' +
        '1000010' +
        '1110100' +
        '1000010' +
        '1100110' +
        '101',
    );
  });

  it('has 95 modules and bars that cover exactly the 1s', () => {
    const modules = ean13Modules('2100000000012')!;
    expect(modules).toHaveLength(95);
    const bars = ean13Bars('2100000000012')!;
    const covered = bars.reduce((sum, bar) => sum + bar.width, 0);
    expect(covered).toBe(
      [...modules].filter((module) => module === '1').length,
    );
    expect(ean13Bars('nope')).toBeNull();
  });
});
