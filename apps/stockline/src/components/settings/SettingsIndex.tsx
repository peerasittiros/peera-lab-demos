'use client';

import type { Locale } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import { ChevronRight } from 'lucide-react';
import { translator } from '../../i18n';
import { AppLink } from '../AppLink';
import { PageHeader } from '../PageHeader';
import { SETTINGS_GROUPS, settingsPath } from './groups';

/** The settings index: every page in its group, with a line on what it holds (the phone's way in). */
export function SettingsIndex({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const s = m.settings;
  return (
    <>
      <PageHeader locale={locale} title={s.title} description={s.subtitle} />
      <div className="flex max-w-[44rem] flex-col gap-6">
        {SETTINGS_GROUPS.map(({ section, pages }) => (
          <section
            key={section}
            aria-labelledby={`settings-${section}`}
            className="flex flex-col gap-2"
          >
            <h2
              id={`settings-${section}`}
              className={cn(
                ts('body-sm', locale),
                'm-0 px-1 font-medium text-ink-muted',
              )}
            >
              {s.sections[section]}
            </h2>
            <ul className="m-0 flex list-none flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-surface-raised p-0">
              {pages.map(({ page, icon: Icon }) => (
                <li key={page}>
                  <AppLink
                    href={settingsPath(locale, page)}
                    className={cn(
                      'flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-sunken',
                      focusRing,
                    )}
                  >
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary"
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(ts('ui', locale), 'font-medium text-ink')}
                      >
                        {s.pages[page].title}
                      </span>
                      <span
                        className={cn(ts('body-sm', locale), 'text-ink-muted')}
                      >
                        {s.pages[page].body}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      size={18}
                      strokeWidth={1.75}
                      className="shrink-0 text-ink-muted"
                    />
                  </AppLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
