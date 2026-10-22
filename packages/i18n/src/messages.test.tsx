import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defineMessages, getPluralT, getT } from './messages';
import { LocaleProvider, useT } from './context';

const en = defineMessages()({
  greeting: 'Hello, {name}',
  cart: { one: '{count} item', other: '{count} items' },
  nested: { saved: 'Saved' },
});
const th = {
  greeting: 'สวัสดี {name}',
  cart: { one: '{count} รายการ', other: '{count} รายการ' },
  nested: { saved: 'บันทึกแล้ว' },
} satisfies typeof en;

function TranslationProbe() {
  const t = useT<typeof en>();
  return <p>{t('nested.saved')}</p>;
}

describe('messages', () => {
  it('interpolates placeholders and resolves nested keys', () => {
    expect(getT('en', en)('greeting', { name: 'Mali' })).toBe('Hello, Mali');
    expect(getT('th', th)('nested.saved')).toBe('บันทึกแล้ว');
  });

  it('throws for missing placeholders and unknown keys', () => {
    expect(() => getT('en', en)('greeting')).toThrow(
      'Missing interpolation value: name',
    );
    expect(() =>
      (getT('en', en) as (key: string) => string)('unknown'),
    ).toThrow('Unknown message key: unknown');
  });

  it('uses English plural categories and one Thai form', () => {
    const englishPlural = getPluralT('en', en);
    expect(englishPlural('cart', 1)).toBe('1 item');
    expect(englishPlural('cart', 3)).toBe('3 items');
    expect(getPluralT('th', th)('cart', 3)).toBe('3 รายการ');
  });

  it('provides the typed translator to client components', () => {
    render(
      <LocaleProvider locale="th" messages={th}>
        <TranslationProbe />
      </LocaleProvider>,
    );
    expect(screen.getByText('บันทึกแล้ว')).toBeInTheDocument();
  });
});
