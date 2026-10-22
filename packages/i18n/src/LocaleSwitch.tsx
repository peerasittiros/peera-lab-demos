'use client';

import { useLocale } from './context';
import type { Locale } from './locale';

export type LocaleSwitchProps = { className?: string };

export function localeSwitchHref(currentHref: string, locale: Locale): string {
  const target = new URL(currentHref);
  const prefixed = target.pathname.match(/^\/(?:th|en)(?=\/|$)/);
  if (prefixed) {
    target.pathname = target.pathname.replace(
      /^\/(?:th|en)(?=\/|$)/,
      `/${locale}`,
    );
    if (target.searchParams.has('lang'))
      target.searchParams.set('lang', locale);
  } else {
    target.searchParams.set('lang', locale);
  }
  return `${target.pathname}${target.search}${target.hash}`;
}

/** Locale selector that retains the current pathname and every query parameter. */
export function LocaleSwitch({ className }: LocaleSwitchProps) {
  const currentLocale = useLocale();
  const switchTo = (locale: Locale) => {
    window.location.assign(localeSwitchHref(window.location.href, locale));
  };

  return (
    <div
      className={className}
      role="group"
      aria-label={currentLocale === 'th' ? 'เลือกภาษา' : 'Choose language'}
    >
      {(['th', 'en'] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={currentLocale === locale}
          onClick={() => switchTo(locale)}
          className="min-h-11 rounded-sm px-3 text-ink hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {locale === 'th' ? 'TH' : 'EN'}
        </button>
      ))}
    </div>
  );
}
