'use client';

import type { Locale } from '@peera/i18n';
import { cn, ErrorState, Skeleton } from '@peera/ui';
import type { ReactNode } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStoreBoot, useStoreStatus } from '@/src/client-store/hooks';
import { translator } from '@/src/i18n';

/**
 * Starts the browser store and shows its state where the live screens are: skeleton rows while loading, then the screen.
 * When the snapshot fails and nothing is stored in this browser there is nothing to show, so the screen is one error
 * with Try again (the Stockline pattern). Above the screen it says when the data is memory-only or was refreshed or is
 * stale (SPEC §2.3).
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

  if (status === 'loading') return <Skeleton locale={locale} lines={4} />;

  if (status === 'error') {
    return (
      <ErrorState
        locale={locale}
        title={p.loadFailed}
        description={m.common.errorBody}
        retryLabel={p.retry}
        onRetry={() => void getStore().start()}
        className="items-start text-left"
      />
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
