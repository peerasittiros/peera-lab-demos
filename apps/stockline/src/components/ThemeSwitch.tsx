'use client';

import type { Locale } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import { useState } from 'react';

type Choice = 'light' | 'dark' | 'device';

/** Matches the storage ThemeScript reads: `theme` in localStorage, mirrored in sessionStorage. */
function storedChoice(): Choice {
  try {
    const value = localStorage.getItem('theme');
    return value === 'light' || value === 'dark' ? value : 'device';
  } catch {
    return 'device';
  }
}

function applyChoice(choice: Choice) {
  const theme =
    choice === 'device'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : choice;
  document.documentElement.dataset.theme = theme;
  try {
    if (choice === 'device') {
      localStorage.removeItem('theme');
      sessionStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', choice);
      sessionStorage.setItem('theme', choice);
    }
  } catch {
    // Not remembered across visits; the theme still changes for this page.
  }
}

/** Light, dark or match the device. The choice is remembered in this browser only. */
export function ThemeSwitch({
  locale,
  options,
}: {
  locale: Locale;
  options: Record<Choice, string>;
}) {
  const [choice, setChoice] = useState<Choice>(() =>
    typeof window === 'undefined' ? 'device' : storedChoice(),
  );

  const choose = (next: Choice) => {
    setChoice(next);
    applyChoice(next);
  };

  return (
    <div
      role="group"
      className="grid grid-cols-3 gap-1 rounded-sm border border-line p-1"
    >
      {(['light', 'dark', 'device'] as const).map((value) => (
        <button
          key={value}
          type="button"
          lang={locale}
          aria-pressed={choice === value}
          onClick={() => choose(value)}
          className={cn(
            ts('ui', locale),
            'min-h-11 rounded-sm px-2 text-ink-muted hover:bg-surface-sunken hover:text-ink',
            'aria-pressed:bg-primary-soft aria-pressed:text-primary',
            focusRing,
          )}
        >
          {options[value]}
        </button>
      ))}
    </div>
  );
}
