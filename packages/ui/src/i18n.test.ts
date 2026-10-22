import { describe, expect, it } from 'vitest';
import { ts } from './i18n';

describe('ts', () => {
  it('uses Thai type styles for Thai and leaves English styles unchanged', () => {
    expect(ts('display-xl', 'th')).toBe('display-xl-th');
    expect(ts('body', 'en')).toBe('body');
  });

  it('keeps code styles unchanged in Thai', () => {
    expect(ts('code', 'th')).toBe('code');
  });
});
