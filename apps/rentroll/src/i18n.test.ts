import { describe, expect, it } from 'vitest';
import { formatDay, formatPeriod } from './i18n';

describe('dates for readers (Thai in the Buddhist year)', () => {
  it('formats a calendar date in both languages', () => {
    expect(formatDay('2026-11-01', 'th')).toBe('1 พ.ย. 2569');
    expect(formatDay('2026-11-01', 'en')).toBe('1 Nov 2026');
  });

  it('keeps a bare date on its day in Bangkok', () => {
    expect(formatDay('2026-01-01', 'th')).toBe('1 ม.ค. 2569');
  });

  it('formats a timestamp in Bangkok time', () => {
    expect(formatDay('2026-10-31T20:00:00Z', 'en')).toBe('1 Nov 2026');
  });

  it('formats a billing period as month and year', () => {
    expect(formatPeriod('2026-10', 'th')).toBe('ต.ค. 2569');
    expect(formatPeriod('2025-11', 'en')).toBe('Nov 2025');
  });
});
