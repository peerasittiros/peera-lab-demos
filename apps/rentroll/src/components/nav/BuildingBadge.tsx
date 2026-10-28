'use client';

import type { Locale } from '@peera/i18n';
import { cn, ts } from '@peera/ui';
import { Building2 } from 'lucide-react';
import { useStore } from '@/src/client-store/hooks';
import { placeView } from '@/src/components/live/views';
import { translator } from '@/src/i18n';

/**
 * The sample property's logo and name, so the demo reads as one real apartment using Rentroll (as Stockline's
 * ShopBadge). `compact` shows the logo only (collapsed sidebar). Holds its place with an empty box until the store
 * has loaded, so the page below doesn't shift.
 */
export function BuildingBadge({
  locale,
  compact = false,
  railBelowLg = false,
  className,
}: {
  locale: Locale;
  compact?: boolean;
  /** In the sidebar: below 1024 the sidebar is an icon rail, so only the logo shows. */
  railBelowLg?: boolean;
  className?: string;
}) {
  const { m } = translator(locale);
  const place = useStore(placeView);
  if (!place) {
    return (
      <div
        aria-hidden
        className={cn('flex min-w-0 items-center gap-3', className)}
      >
        <span className="size-10 shrink-0 rounded-md bg-surface-sunken" />
        {compact ? null : (
          <span className={cn('grid min-w-0', railBelowLg && 'max-lg:hidden')}>
            <span className={cn(ts('ui', locale), 'invisible')}>&nbsp;</span>
            <span className={cn(ts('body-sm', locale), 'invisible')}>
              &nbsp;
            </span>
          </span>
        )}
      </div>
    );
  }
  const name = (locale === 'en' && place.en) || place.th;

  return (
    <div
      className={cn('flex min-w-0 items-center gap-3', className)}
      title={compact ? name : undefined}
    >
      <span
        role="img"
        aria-label={`${m.app.placeLogo} ${name}`}
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-product-accent text-product-on-accent shadow-sm"
      >
        <Building2 aria-hidden size={22} strokeWidth={1.75} />
      </span>
      {compact ? null : (
        <span className={cn('grid min-w-0', railBelowLg && 'max-lg:hidden')}>
          <span className={cn(ts('ui', locale), 'font-semibold text-ink')}>
            {name}
          </span>
          <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
            {m.app.samplePlace}
          </span>
        </span>
      )}
    </div>
  );
}
