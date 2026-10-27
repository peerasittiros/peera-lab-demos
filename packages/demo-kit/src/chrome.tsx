'use client';

import type { Locale } from '@peera/i18n';
import { Button, cn, focusRing, ts } from '@peera/ui';
import { Info, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useEmbedded } from './demo-session';
import { kitStrings } from './strings';

/** One line under a page header: the data here is made up. */
export function SampleDataNotice({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  return (
    <p
      lang={locale}
      className={cn(
        ts('body-sm', locale),
        'flex items-start gap-2 text-ink-muted',
        className,
      )}
    >
      <Info
        aria-hidden
        size={16}
        strokeWidth={1.75}
        className="mt-1 shrink-0"
      />
      {kitStrings[locale].sampleNotice}
    </p>
  );
}

/**
 * "Want a system like this?" → the website's contact page in the same language. Inside the iframe it opens in the
 * top window (`target="_top"`), which the website's sandbox allows on a click.
 */
export function ContactLink({
  locale,
  siteUrl,
  className,
}: {
  locale: Locale;
  siteUrl: string;
  className?: string;
}) {
  const embedded = useEmbedded();
  return (
    <a
      href={`${siteUrl.replace(/\/$/, '')}/${locale}/contact`}
      target={embedded ? '_top' : undefined}
      lang={locale}
      className={cn(
        ts('ui', locale),
        'inline-flex min-h-11 items-center rounded-sm text-ink underline',
        focusRing,
        className,
      )}
    >
      {kitStrings[locale].contact}
    </a>
  );
}

export type CoachStep = { title: string; body: string };

export type CoachMarksProps = {
  locale: Locale;
  /** Three steps, written by the app ("Try this first…"). */
  steps: CoachStep[];
  /** Remembered per tab in sessionStorage, so the tour shows once per visit. */
  storageKey: string;
  /** `floating` (default) sits over the page at the bottom; `inline` is a card in the page flow that never covers content. */
  placement?: 'floating' | 'inline';
  className?: string;
};

/** A small, non-modal first-visit tour. Escape or "Skip" dismisses it; it doesn't come back in this tab. */
export function CoachMarks({
  locale,
  steps,
  storageKey,
  placement = 'floating',
  className,
}: CoachMarksProps) {
  const strings = kitStrings[locale];
  const key = `peera:coach:${storageKey}`;
  // Inline: in the server HTML from the start, so a first visit has no layout shift; a visitor who already
  // dismissed it in this tab sees it removed on mount. Floating: added on mount (it covers, never shifts).
  const [open, setOpen] = useState(placement === 'inline');
  const [index, setIndex] = useState(0);
  const titleId = useId();

  useEffect(() => {
    try {
      setOpen(sessionStorage.getItem(key) !== 'done');
    } catch {
      setOpen(true);
    }
  }, [key]);

  const dismiss = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(key, 'done');
    } catch {
      // Storage blocked (private mode, third-party frame): the tour just shows again next time.
    }
  };

  const step = steps[index];
  if (!open || !step) return null;
  const last = index === steps.length - 1;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      lang={locale}
      onKeyDown={(event) => {
        if (event.key === 'Escape') dismiss();
      }}
      className={cn(
        ts('body-sm', locale),
        placement === 'inline'
          ? 'relative rounded-md border border-line bg-surface-raised p-4 text-ink'
          : 'fixed inset-x-3 bottom-3 z-40 rounded-md border border-line bg-surface-raised p-4 text-ink shadow-lift md:inset-x-auto md:right-4 md:bottom-4 md:w-96',
        className,
      )}
    >
      <p className="text-ink-muted">
        {strings.tourLabel} ·{' '}
        {strings.tourStep
          .replace('{n}', String(index + 1))
          .replace('{total}', String(steps.length))}
      </p>
      <h2 id={titleId} className={cn(ts('title', locale), 'mt-1')}>
        {step.title}
      </h2>
      <p className="mt-1">{step.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button locale={locale} variant="ghost" size="sm" onClick={dismiss}>
          {strings.tourSkip}
        </Button>
        <div className="ml-auto flex gap-2">
          {index > 0 ? (
            <Button
              locale={locale}
              size="sm"
              onClick={() => setIndex(index - 1)}
            >
              {strings.tourBack}
            </Button>
          ) : null}
          <Button
            locale={locale}
            size="sm"
            variant="secondary"
            autoFocus
            onClick={() => (last ? dismiss() : setIndex(index + 1))}
          >
            {last ? strings.tourDone : strings.tourNext}
          </Button>
        </div>
      </div>
      <button
        type="button"
        aria-label={strings.tourSkip}
        onClick={dismiss}
        className={cn(
          'absolute top-2 right-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken md:min-h-9 md:min-w-9',
          focusRing,
        )}
      >
        <X aria-hidden size={16} strokeWidth={1.75} />
      </button>
    </section>
  );
}
