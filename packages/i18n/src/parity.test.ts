import { describe, expect, it } from 'vitest';
import { expectParity } from './parity';

describe('expectParity', () => {
  it('accepts matching nested and plural keys with non-empty values', () => {
    expect(() =>
      expectParity(
        {
          nav: { home: 'Home' },
          items: { one: 'One item', other: '{count} items' },
        },
        {
          nav: { home: 'หน้าหลัก' },
          items: { one: 'หนึ่งรายการ', other: '{count} รายการ' },
        },
      ),
    ).not.toThrow();
  });

  it('fails when Thai is missing a message key', () => {
    expect(() =>
      expectParity(
        { nav: { home: 'Home', back: 'Back' } },
        { nav: { home: 'หน้าหลัก' } },
      ),
    ).toThrow('missing in th: nav.back');
  });

  it('fails for extra and empty values', () => {
    expect(() =>
      expectParity({ title: 'Title' }, { title: ' ', extra: 'เพิ่ม' }),
    ).toThrow('extra in th: extra');
    expect(() => expectParity({ title: '' }, { title: 'ชื่อ' })).toThrow(
      'empty values: title',
    );
  });
});
