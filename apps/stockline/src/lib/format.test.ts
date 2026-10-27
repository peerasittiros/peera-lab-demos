import { describe, expect, it } from 'vitest';
import { formatQty, formatSigned, unitName } from './format';

const bottle = { nameTh: 'ขวด', nameEn: 'Bottle', symbol: 'btl' };
const box = { nameTh: 'กล่อง', nameEn: 'Box', symbol: 'box' };
const gram = { nameTh: 'กรัม', nameEn: 'Gram', symbol: 'g' };

describe('unit formatting', () => {
  it('writes Thai units as they are', () => {
    expect(formatQty(48, bottle, 'th')).toBe('48 ขวด');
    expect(formatQty(1, bottle, 'th')).toBe('1 ขวด');
  });

  it('pluralises English names and keeps metric symbols', () => {
    expect(formatQty(48, bottle, 'en')).toBe('48 bottles');
    expect(formatQty(1, bottle, 'en')).toBe('1 bottle');
    expect(formatQty(3, box, 'en')).toBe('3 boxes');
    expect(formatQty(1500, gram, 'en')).toBe('1,500 g');
    expect(
      unitName({ nameTh: 'แบตเตอรี่', nameEn: 'Battery', symbol: 'bat' }, 'en'),
    ).toBe('batteries');
  });

  it('falls back to the Thai name when there is no English one', () => {
    expect(
      formatQty(2, { nameTh: 'มัด', nameEn: null, symbol: 'bdl' }, 'en'),
    ).toBe('2 มัด');
  });

  it('signs ledger quantities with a real minus', () => {
    expect(formatSigned(24, 'en')).toBe('+24');
    expect(formatSigned(-1250, 'th')).toBe('−1,250');
  });
});
