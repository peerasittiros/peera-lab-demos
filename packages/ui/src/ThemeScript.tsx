'use client';

import { useLayoutEffect } from 'react';

function applyTheme() {
  try {
    const root = globalThis.document.documentElement;
    const requestedTheme = new globalThis.URLSearchParams(
      globalThis.window.location.search,
    ).get('theme');
    let theme: string | null = null;

    if (requestedTheme === 'light' || requestedTheme === 'dark') {
      theme = requestedTheme;
      globalThis.sessionStorage.setItem('theme', theme);
    } else {
      theme = globalThis.sessionStorage.getItem('theme');
      if (theme !== 'light' && theme !== 'dark')
        theme = globalThis.localStorage.getItem('theme');
    }

    if (theme !== 'light' && theme !== 'dark') {
      theme = globalThis.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    root.dataset.theme = theme;
  } catch {
    globalThis.document.documentElement.dataset.theme = globalThis.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches
      ? 'dark'
      : 'light';
  }
}

const script = `(${applyTheme.toString()})()`;

/** Set the theme before paint on the server and repair it before paint after client navigation. */
export function ThemeScript() {
  useLayoutEffect(() => {
    if (!globalThis.document.documentElement.dataset.theme) applyTheme();
  }, []);

  return (
    <script
      type={typeof window === 'undefined' ? undefined : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
