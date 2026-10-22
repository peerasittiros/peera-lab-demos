import { describe, expect, it } from 'vitest';
import { createLocaleProxy, defaultLocale, resolveLocale } from './locale';

describe('resolveLocale', () => {
  it('defaults to Thai', () => {
    expect(defaultLocale).toBe('th');
    expect(resolveLocale({})).toBe('th');
  });

  it('follows query, cookie, then Accept-Language precedence', () => {
    expect(
      resolveLocale({
        query: '?lang=en',
        cookie: 'locale=th',
        acceptLanguage: 'th-TH, en;q=0.8',
      }),
    ).toBe('en');
    expect(
      resolveLocale({
        cookie: 'theme=dark; locale=en',
        acceptLanguage: 'th-TH',
      }),
    ).toBe('en');
    expect(
      resolveLocale({ acceptLanguage: 'fr-FR, th-TH;q=0.8, en;q=0.7' }),
    ).toBe('th');
  });

  it('respects Accept-Language quality and ignores unsupported locales', () => {
    expect(
      resolveLocale({ acceptLanguage: 'fr-FR, en-US;q=0.9, th;q=0.2' }),
    ).toBe('en');
    expect(resolveLocale({ acceptLanguage: 'en;q=0, th;q=0' })).toBe('th');
    expect(resolveLocale({ acceptLanguage: 'en;q=invalid, th;q=0.5' })).toBe(
      'th',
    );
  });
});

describe('createLocaleProxy', () => {
  const proxy = createLocaleProxy();

  it('redirects an unprefixed URL and preserves path plus all query parameters', () => {
    const response = proxy(
      new Request(
        'https://demo.example/orders/42?lang=en&theme=dark&embed=1&sid=abc',
      ),
    );
    expect(response?.status).toBe(307);
    const location = response?.headers.get('location');
    expect(location).toBe(
      'https://demo.example/en/orders/42?lang=en&theme=dark&embed=1&sid=abc',
    );
    expect(response?.headers.get('set-cookie')).toContain('locale=en');
  });

  it('uses locale cookie then Accept-Language and does not set a cookie without ?lang', () => {
    const byCookie = proxy(
      new Request('https://demo.example/orders', {
        headers: { cookie: 'locale=en', 'accept-language': 'th-TH' },
      }),
    );
    expect(byCookie?.headers.get('location')).toBe(
      'https://demo.example/en/orders',
    );
    expect(byCookie?.headers.get('set-cookie')).toBeNull();

    const byHeader = proxy(
      new Request('https://demo.example/orders', {
        headers: { 'accept-language': 'en-US' },
      }),
    );
    expect(byHeader?.headers.get('location')).toBe(
      'https://demo.example/en/orders',
    );
  });

  it('redirects the root and leaves already-prefixed paths alone', () => {
    expect(
      proxy(new Request('https://demo.example/'))?.headers.get('location'),
    ).toBe('https://demo.example/th');
    expect(proxy(new Request('https://demo.example/th/orders'))).toBeNull();
    expect(proxy(new Request('https://demo.example/en'))).toBeNull();
  });

  it('does not persist an invalid ?lang value', () => {
    const response = proxy(
      new Request('https://demo.example/orders?lang=fr&sid=abc'),
    );
    expect(response?.headers.get('location')).toBe(
      'https://demo.example/th/orders?lang=fr&sid=abc',
    );
    expect(response?.headers.get('set-cookie')).toBeNull();
  });
});
