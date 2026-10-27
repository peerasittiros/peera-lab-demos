'use client';

import type { Locale } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import { ChevronLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { translator } from '../../i18n';
import { AppLink } from '../AppLink';
import { SETTINGS_GROUPS, settingsPath } from './groups';

/**
 * The frame around every settings page. From 768 px the groups stay in a column beside the page; on phones the
 * index is the list itself and each page gets a back link to it.
 */
export function SettingsFrame({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const { m } = translator(locale);
  const pathname = usePathname();
  const isIndex = pathname.replace(/\/$/, '') === settingsPath(locale);

  return (
    <div className="md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav
        aria-label={m.settings.title}
        className="hidden md:sticky md:top-8 md:flex md:flex-col md:gap-5 md:self-start"
      >
        {SETTINGS_GROUPS.map(({ section, pages }) => (
          <div key={section} className="flex flex-col gap-1">
            <span
              className={cn(
                ts('body-sm', locale),
                'px-3 font-medium text-ink-muted',
              )}
            >
              {m.settings.sections[section]}
            </span>
            {pages.map(({ page, icon: Icon }) => {
              const href = settingsPath(locale, page);
              const current =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <AppLink
                  key={page}
                  href={href}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    ts('ui', locale),
                    'flex min-h-10 items-center gap-3 rounded-sm px-3 text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    'aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary',
                    focusRing,
                  )}
                >
                  <Icon
                    aria-hidden
                    size={18}
                    strokeWidth={1.75}
                    className="shrink-0"
                  />
                  {m.settings.pages[page].title}
                </AppLink>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="min-w-0">
        {isIndex ? null : (
          <AppLink
            href={settingsPath(locale)}
            className={cn(
              ts('ui', locale),
              '-ml-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-ink-muted hover:text-ink md:hidden',
              focusRing,
            )}
          >
            <ChevronLeft aria-hidden size={18} strokeWidth={1.75} />
            {m.settings.back}
          </AppLink>
        )}
        {children}
      </div>
    </div>
  );
}
