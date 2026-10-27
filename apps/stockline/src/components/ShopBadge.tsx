'use client';

import type { Locale } from '@peera/i18n';
import { cn, ts } from '@peera/ui';
import { Coffee, Hammer, ShoppingBasket, Store, type LucideIcon } from 'lucide-react';
import { useStoreState } from '../client-store/hooks';
import { translator } from '../i18n';

// Each sample shop gets a simple logo: its trade's icon on a teal tile. The shops are made up for the demo.
const LOGOS: Record<string, LucideIcon> = {
  minimart: ShoppingBasket,
  cafe: Coffee,
  hardware: Hammer,
};

/**
 * The sample shop's logo and name, so the demo reads as one real shop using Stockline.
 * `compact` shows the logo only (collapsed sidebar). Holds its place with an empty box until the shop has loaded.
 */
export function ShopBadge({
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
  const { ledger, variant } = useStoreState();
  // Until the shop loads, an empty box of the same size holds its place, so the page below doesn't shift.
  if (!ledger) {
    return (
      <div aria-hidden className={cn('flex min-w-0 items-center gap-3', className)}>
        <span className="size-10 shrink-0 rounded-md bg-surface-sunken" />
        {compact ? null : (
          <span className={cn('grid min-w-0', railBelowLg && 'max-lg:hidden')}>
            <span className={cn(ts('ui', locale), 'invisible')}>&nbsp;</span>
            <span className={cn(ts('body-sm', locale), 'invisible')}>&nbsp;</span>
          </span>
        )}
      </div>
    );
  }
  const name =
    (locale === 'en' && ledger.settings.shopNameEn) || ledger.settings.shopNameTh;
  const Logo = (variant && LOGOS[variant]) || Store;
  const logoUrl = ledger.settings.logoUrl;

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)} title={compact ? name : undefined}>
      {/* The logo the owner uploaded (Settings › Shop), else the trade's icon on the brand tile. */}
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL from this browser; nothing to optimise
        <img
          src={logoUrl}
          alt={`${m.app.shopLogo} ${name}`}
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-md border border-line object-cover shadow-sm"
        />
      ) : (
        <span
          role="img"
          aria-label={`${m.app.shopLogo} ${name}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm"
        >
          <Logo aria-hidden size={22} strokeWidth={1.75} />
        </span>
      )}
      {compact ? null : (
        <span className={cn('grid min-w-0', railBelowLg && 'max-lg:hidden')}>
          <span className={cn(ts('ui', locale), 'truncate font-semibold text-ink')}>{name}</span>
          <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>{m.app.sampleShop}</span>
        </span>
      )}
    </div>
  );
}
