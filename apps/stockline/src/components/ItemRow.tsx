import type { Locale } from '@peera/i18n';
import { cn, ts } from '@peera/ui';
import { Package } from 'lucide-react';
import type { ItemView } from '../domain/read-models';
import { nameIn } from '../i18n';
import { formatQty } from '../lib/format';
import { ItemStatusBadge } from './ItemStatusBadge';
import { RollingNumber } from './RollingNumber';

/** 40px photo slot: the item photo, or a quiet placeholder (the sample shops have no photos). */
export function ItemThumb({
  item,
  size = 40,
}: {
  item: Pick<ItemView, 'imageUrl'>;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-surface-sunken text-ink-muted"
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user images of unknown size; no optimisation needed
        <img
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <Package size={Math.round(size / 2)} strokeWidth={1.75} />
      )}
    </span>
  );
}

/** One item in a pickable list: photo, name, SKU, on hand with unit, status. */
export function ItemRowContent({
  item,
  locale,
  emphasis = false,
}: {
  item: ItemView;
  locale: Locale;
  /** Quick move: a larger photo and the quantity in the big numeric face. */
  emphasis?: boolean;
}) {
  return (
    <span className="flex w-full items-center gap-3">
      <ItemThumb item={item} size={emphasis ? 48 : 40} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn(ts('ui', locale), 'text-ink')}>
          {nameIn(item, locale)}
        </span>
        <span className="code text-ink-muted">{item.sku}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            emphasis ? 'num text-xl leading-tight' : ts('ui', locale),
            'tabular-nums text-ink',
          )}
        >
          <RollingNumber value={item.onHand} format={(value) => formatQty(value, item.baseUnit, locale)} />
        </span>
        <ItemStatusBadge status={item.status} locale={locale} />
      </span>
    </span>
  );
}
