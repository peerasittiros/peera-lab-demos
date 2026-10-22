import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatPhone,
  formatRelative,
  formatTime,
} from './format';

describe('formatters', () => {
  const instant = '2026-10-20T17:00:00.000Z';

  it('formats satang in table and prose styles for both locales', () => {
    expect(formatMoney(125000, 'th')).toMatch(/฿\s?1,250\.00/);
    expect(formatMoney(125000, 'en')).toMatch(/฿\s?1,250\.00/);
    expect(formatMoney(125000, 'th', 'prose')).toBe('1,250 บาท');
    expect(formatMoney(125000, 'en', 'prose')).toBe('THB 1,250');
  });

  it('formats dates with Buddhist Era in Thai and en-GB order in English', () => {
    expect(formatDate(instant, 'th')).toContain('2569');
    expect(formatDate(instant, 'th')).toContain('ต.ค.');
    expect(formatDate(instant, 'en')).toBe('21 Oct 2026');
  });

  it('formats a UTC timestamp in Bangkok time and 24-hour clock', () => {
    expect(formatTime(instant, 'th')).toBe('00:00 น.');
    expect(formatTime(instant, 'en')).toBe('00:00');
    expect(formatDateTime(instant, 'th')).toContain('00:00 น.');
    expect(formatDateTime(instant, 'en')).toContain('00:00');
  });

  it('formats numbers and percentages for both locales with Arabic digits', () => {
    expect(formatNumber(1234.5, 'th', { maximumFractionDigits: 1 })).toBe(
      '1,234.5',
    );
    expect(formatNumber(1234.5, 'en', { maximumFractionDigits: 1 })).toBe(
      '1,234.5',
    );
    expect(formatPercent(0.125, 'th', 1)).toBe('12.5%');
    expect(formatPercent(0.125, 'en', 1)).toBe('12.5%');
  });

  it('formats relative time in both locales deterministically', () => {
    expect(
      formatRelative('2026-10-21T01:00:00Z', 'en', '2026-10-21T00:00:00Z'),
    ).toBe('in 1 hour');
    expect(
      formatRelative('2026-10-21T01:00:00Z', 'th', '2026-10-21T00:00:00Z'),
    ).toContain('1');
  });

  it('normalizes Thai phone numbers to E.164 and display format', () => {
    expect(formatPhone('081-234-5678', 'storage')).toBe('+66812345678');
    expect(formatPhone('+66812345678')).toBe('081-234-5678');
    expect(formatPhone('0066812345678')).toBe('081-234-5678');
    expect(() => formatPhone('1234')).toThrow(RangeError);
  });
});
