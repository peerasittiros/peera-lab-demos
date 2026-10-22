import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider } from './context';
import { LocaleSwitch, localeSwitchHref } from './LocaleSwitch';

describe('LocaleSwitch', () => {
  it('keeps the path, query, and hash while switching a locale prefix', () => {
    expect(
      localeSwitchHref(
        'https://demo.example/th/orders?sid=abc&theme=dark#today',
        'en',
      ),
    ).toBe('/en/orders?sid=abc&theme=dark#today');
  });

  it('sets lang for an unprefixed path without dropping other query parameters', () => {
    expect(
      localeSwitchHref('https://demo.example/orders?sid=abc#today', 'en'),
    ).toBe('/orders?sid=abc&lang=en#today');
  });

  it('exposes the current locale and accessible language choices', () => {
    render(
      <LocaleProvider locale="th" messages={{ title: 'หน้าหลัก' }}>
        <LocaleSwitch />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole('group', { name: 'เลือกภาษา' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TH' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
