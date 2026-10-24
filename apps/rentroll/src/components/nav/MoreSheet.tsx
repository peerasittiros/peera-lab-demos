'use client';

import type { Locale } from '@peera/i18n';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  SheetContent,
  SheetDescription,
  SheetTitle,
  cn,
  focusRing,
  Sheet,
  ts,
} from '@peera/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InstallButton } from '@/src/components/pwa/InstallButton';
import { getStore } from '@/src/client-store/instance';
import type { Messages } from '@/messages';
import { isNavActive, type NavItem } from './nav-config';

/**
 * "More" (SPEC §3): every section the bottom bar doesn't show, then the language, the theme and a reset of the sample
 * data. The sheet is bottom-anchored on phones and a side panel from 768px.
 */
export function MoreSheet({
  locale,
  m,
  pathname,
  sections,
  open,
  onOpenChange,
}: {
  locale: Locale;
  m: Messages;
  pathname: string;
  sections: NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const other: Locale = locale === 'th' ? 'en' : 'th';
  const languageHref = `/${other}${pathname.slice(`/${locale}`.length)}`;
  const [resetOpen, setResetOpen] = useState(false);

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
          <div className="flex items-center justify-between gap-3">
            <span className={ts('ui', locale)}>{m.nav.resetDemo}</span>
            <Button
              locale={locale}
              variant="ghost"
              size="md"
              onClick={() => setResetOpen(true)}
            >
              {m.nav.resetDemo}
            </Button>
          </div>
        </div>
      </SheetContent>

      <ResetSampleData
        locale={locale}
        m={m}
        open={resetOpen}
        onOpenChange={setResetOpen}
      />
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

/** The reset confirmation. Reset deletes this device's changes, then the page reloads on the fresh sample data. */
function ResetSampleData({
  locale,
  m,
  open,
  onOpenChange,
}: {
  locale: Locale;
  m: Messages;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      await getStore().reset();
      router.refresh();
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent locale={locale}>
        <DialogTitle locale={locale}>{m.nav.resetTitle}</DialogTitle>
        <DialogDescription locale={locale}>{m.nav.resetBody}</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            locale={locale}
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {m.common.cancel}
          </Button>
          <Button
            locale={locale}
            variant="danger"
            disabled={busy}
            onClick={reset}
          >
            {m.nav.resetConfirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
