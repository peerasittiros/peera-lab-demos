'use client';

import type { Locale } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

type View = 'customer' | 'shop';

export type DemoSplitProps = {
  locale: Locale;
  /** The customer-facing side, usually inside a PhoneFrame. */
  customer: ReactNode;
  /** The back office. */
  shop: ReactNode;
  /** Tab labels, written by the app ("มุมมองผู้เช่า / Tenant view"…). */
  labels: { customer: string; shop: string };
  className?: string;
};

/**
 * Customer and shop side by side from 1024px, both live; below that, two tabs. Both sides stay mounted at every
 * width (the inactive tab is only hidden), so live updates keep flowing and nothing loads twice.
 */
export function DemoSplit({
  locale,
  customer,
  shop,
  labels,
  className,
}: DemoSplitProps) {
  const [active, setActive] = useState<View>('customer');
  const id = useId();
  const tabs = useRef<Record<View, HTMLButtonElement | null>>({
    customer: null,
    shop: null,
  });
  const views: View[] = ['customer', 'shop'];

  const onKeyDown = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 'customer'
        : event.key === 'End'
          ? 'shop'
          : active === 'customer'
            ? 'shop'
            : 'customer';
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div lang={locale} className={cn('w-full', className)}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="mb-4 flex gap-1 border-b border-line lg:hidden"
        onKeyDown={onKeyDown}
      >
        {views.map((view) => (
          <button
            key={view}
            ref={(node) => {
              tabs.current[view] = node;
            }}
            type="button"
            role="tab"
            id={`${id}-${view}-tab`}
            aria-selected={active === view}
            aria-controls={`${id}-${view}`}
            tabIndex={active === view ? 0 : -1}
            onClick={() => setActive(view)}
            className={cn(
              ts('ui', locale),
              '-mb-px min-h-11 rounded-t-sm border-b-2 px-4',
              active === view
                ? 'border-product-accent text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
              focusRing,
            )}
          >
            {labels[view]}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)] lg:items-start">
        {views.map((view) => (
          <section
            key={view}
            id={`${id}-${view}`}
            role="tabpanel"
            aria-labelledby={`${id}-${view}-tab`}
            aria-label={labels[view]}
            className={cn('min-w-0', active !== view && 'max-lg:hidden')}
          >
            {view === 'customer' ? customer : shop}
          </section>
        ))}
      </div>
    </div>
  );
}
