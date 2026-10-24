'use client';

import type { Locale } from '@peera/i18n';
import { Button, cn, focusRing, ts } from '@peera/ui';
import type { ReactNode } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStoreBoot, useStoreStatus } from '@/src/client-store/hooks';
import { translator } from '@/src/i18n';

/**
 * Starts the browser store and shows its state where the live screens are: a loading placeholder, an error with a retry,
 * then the screen. Above the screen it says when the data is memory-only or was refreshed or is stale (SPEC §2.3).
 */
export function ReadyGate({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  useStoreBoot();
  const { status, memoryOnly, note } = useStoreStatus();
  const { m } = translator(locale);
  const p = m.tenant.live;

  if (status === 'loading') {
    return (
      <div role="status" lang={locale} className="flex flex-col gap-3">
        <p className={cn(ts('body', locale), 'text-ink-muted')}>{p.loading}</p>
        <div aria-hidden className="h-24 rounded-sm bg-surface-sunken" />
        <div aria-hidden className="h-24 rounded-sm bg-surface-sunken" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        lang={locale}
        className="flex flex-col items-start gap-3"
      >
        <p className={cn(ts('body', locale), 'text-ink')}>{p.loadFailed}</p>
        <Button
          type="button"
          variant="secondary"
          locale={locale}
          className={focusRing}
          onClick={() => void getStore().start()}
        >
          {p.retry}
        </Button>
      </div>
    );
  }

  const notices: string[] = [];
  if (memoryOnly) notices.push(p.memoryOnly);
  if (note?.kind === 'refreshed') notices.push(p.refreshed);
  if (note?.kind === 'stale') notices.push(p.stale);

  return (
    <div className="flex flex-col gap-4">
      {notices.length > 0 ? (
        <div
          lang={locale}
          className="flex flex-col gap-1 rounded-sm border border-line bg-surface-sunken p-3"
        >
          {notices.map((text) => (
            <p
              key={text}
              className={cn(
                locale === 'th' ? 'caption-th' : 'caption',
                'text-ink-muted',
              )}
            >
              {text}
            </p>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}
