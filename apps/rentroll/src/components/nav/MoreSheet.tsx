'use client';

import { kitStrings, newTabHref, useEmbedded } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import {
  Button,
  SegmentedControl,
  SheetContent,
  SheetDescription,
  SheetTitle,
  cn,
  focusRing,
  Sheet,
  ts,
} from '@peera/ui';
import { ExternalLink, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { InstallButton } from '@/src/components/pwa/InstallButton';
import type { Role } from '@/src/client-store/schema';
import type { Messages } from '@/messages';
import { isNavActive, type NavItem } from './nav-config';

/**
 * "More" on phones (SPEC §3): every section the bottom bar doesn't show, then what the account menu holds on larger
 * screens (role, language), the theme and the demo's reset. The sheet is bottom-anchored.
 */
export function MoreSheet({
  locale,
  m,
  pathname,
  sections,
  open,
  onOpenChange,
  role,
  onRoleChange,
  onReset,
}: {
  locale: Locale;
  m: Messages;
  pathname: string;
  sections: NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
  onRoleChange: (role: string) => void;
  onReset: () => void;
}) {
  const other: Locale = locale === 'th' ? 'en' : 'th';
  const languageHref = `/${other}${pathname.slice(`/${locale}`.length)}`;
  const embedded = useEmbedded();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent locale={locale}>
        <SheetTitle locale={locale}>{m.nav.moreLabel}</SheetTitle>
        <SheetDescription locale={locale} className="sr-only">
          {m.nav.moreLabel}
        </SheetDescription>

        <nav aria-label={m.nav.moreLabel} className="mt-4">
          <ul className="flex flex-col">
            {sections.map((item) => (
              <li key={item.key}>
                <Link
                  prefetch={false}
                  href={`/${locale}${item.path}`}
                  aria-current={
                    isNavActive(item, pathname, locale) ? 'page' : undefined
                  }
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    ts('ui', locale),
                    'flex min-h-11 items-center gap-3 rounded-sm px-3 text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    'aria-[current=page]:bg-product-accent-soft aria-[current=page]:text-product-accent',
                    focusRing,
                  )}
                >
                  <item.icon
                    aria-hidden
                    size={20}
                    strokeWidth={1.75}
                    className="shrink-0"
                  />
                  <span>{m.nav[item.key]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          <div className="grid gap-2">
            <span className={cn(ts('ui', locale), 'text-ink-muted')}>
              {m.nav.role}
            </span>
            <SegmentedControl
              locale={locale}
              fullWidth
              aria-label={m.nav.role}
              value={role}
              onValueChange={(next) => {
                onOpenChange(false);
                onRoleChange(next);
              }}
              options={[
                { value: 'owner', label: m.rolesShort.owner },
                { value: 'caretaker', label: m.rolesShort.caretaker },
                { value: 'tenant', label: m.rolesShort.tenant },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className={ts('ui', locale)}>{m.nav.language}</span>
            <Link
              prefetch={false}
              lang={other}
              href={languageHref}
              className={cn(
                ts('ui', other),
                'inline-flex min-h-11 items-center rounded-sm px-3 text-product-accent',
                focusRing,
              )}
            >
              {other === 'th' ? 'ภาษาไทย' : 'English'}
            </Link>
          </div>
          <div className="flex items-center justify-between gap-3">
            <InstallButton locale={locale} />
          </div>
          <ThemeChoice locale={locale} m={m} />
          <Button
            locale={locale}
            variant="ghost"
            className="justify-start"
            onClick={() => {
              onOpenChange(false);
              onReset();
            }}
          >
            <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
            {kitStrings[locale].reset}
          </Button>
          {embedded ? (
            <Button
              locale={locale}
              variant="ghost"
              className="justify-start"
              onClick={() => {
                const theme =
                  document.documentElement.dataset.theme === 'dark'
                    ? 'dark'
                    : 'light';
                window.open(
                  newTabHref(window.location.href, locale, theme),
                  '_blank',
                  'noopener',
                );
              }}
            >
              <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
              {kitStrings[locale].openInNewTab}
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const THEME_KEY = 'theme';

function ThemeChoice({ locale, m }: { locale: Locale; m: Messages }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme(
      document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    );
  }, []);

  function choose(next: 'light' | 'dark') {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
      sessionStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be blocked; the theme then lasts for this page.
    }
  }

  const options = [
    { value: 'light' as const, label: m.nav.themeLight },
    { value: 'dark' as const, label: m.nav.themeDark },
  ];

  return (
    <div className="flex items-center justify-between gap-3">
      <span id="theme-label" className={ts('ui', locale)}>
        {m.nav.theme}
      </span>
      <div
        role="group"
        aria-labelledby="theme-label"
        className="inline-flex rounded-sm border border-line-strong p-0.5"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={theme === option.value}
            onClick={() => choose(option.value)}
            className={cn(
              ts('ui', locale),
              'min-h-10 rounded-xs px-3',
              theme === option.value
                ? 'bg-product-accent-soft text-product-accent'
                : 'text-ink-muted hover:text-ink',
              focusRing,
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
