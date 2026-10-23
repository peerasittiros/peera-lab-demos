import { describe, expect, it } from 'vitest';
import { baht, toCsv } from './csv';

describe('toCsv', () => {
  it('starts with a byte-order mark and ends lines with CRLF', () => {
    const text = toCsv(['ห้อง', 'ยอด'], [['A-101', '7232.00']]);
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).toBe('﻿ห้อง,ยอด\r\nA-101,7232.00\r\n');
  });

  it('quotes cells with commas, quotes and line breaks, and doubles quotes', () => {
    const text = toCsv(['ชื่อ'], [['สมชาย, "ใจดี"'], ['บรรทัด\nสอง']]);
    expect(text).toContain('"สมชาย, ""ใจดี"""');
    expect(text).toContain('"บรรทัด\nสอง"');
  });

  it('writes an empty cell for null', () => {
    expect(toCsv(['a', 'b'], [[null, 1]])).toBe('﻿a,b\r\n,1\r\n');
  });
});

describe('baht', () => {
  it('shows satang as baht with two decimals', () => {
    expect(baht(723200)).toBe('7232.00');
    expect(baht(5)).toBe('0.05');
  });
});
