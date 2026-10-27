'use client';

import { formatMoney, type Locale } from '@peera/i18n';
import { Button, cn, toast, ts } from '@peera/ui';
import { useState } from 'react';
import { useStoreState } from '../client-store/hooks';
import { categoryViews, movementViews, supplierViews } from '../client-store/views';
import type { ItemView } from '../domain/read-models';
import type { Role } from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { formatQty, formatSigned, unitName } from '../lib/format';
import { AppLink } from './AppLink';
import { MovementCards } from './Movements';
import { MovePanelHeader, MoveSheet } from './MoveSheet';
import { buttonLink } from './styles';

/**
 * The items page's detail pane from 1280 px (ux-v2/stockline.md V4): the item at a glance beside the table, so the
 * owner can scan items without changing page. The full page is one link away; a movement opens the move sheet.
 */
export function ItemPreview({ item, locale, role }: { item: ItemView; locale: Locale; role: Role }) {
  const { t, m } = translator(locale);
  const { ledger } = useStoreState();
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveKey, setMoveKey] = useState(0);
  if (!ledger) return null;

  const category = categoryViews(ledger).find((entry) => entry.id === item.categoryId);
  const supplier = supplierViews(ledger).find((entry) => entry.id === item.supplierId);
  const moves = movementViews(ledger, role, { itemId: item.id, limit: 5 });
  const facts: [string, string][] = [
    [m.items.columns.category, category ? nameIn(category, locale) : m.common.noCategory],
    [m.items.overview.supplier, supplier ? supplier.name : m.common.noSupplier],
    [m.items.overview.location, item.location ?? ''],
    [m.items.overview.minQty, formatQty(item.minQty, item.baseUnit, locale)],
    [m.items.overview.reorderQty, formatQty(item.reorderQty, item.baseUnit, locale)],
    ...(role === 'owner' && item.costSatang != null
      ? ([[m.items.overview.cost, formatMoney(item.costSatang, locale)]] as [string, string][])
      : []),
  ];

  return (
    <aside
      aria-label={nameIn(item, locale)}
      className="sticky top-8 flex flex-col gap-5 rounded-md border border-line bg-surface-raised p-5"
    >
      <MovePanelHeader item={item} locale={locale} />
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className={cn(ts('body-sm', locale), 'text-ink-muted')}>{label}</dt>
            <dd className={cn(ts('ui', locale), 'm-0 text-ink')}>{value || '–'}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button
          locale={locale}
          variant="primary"
          onClick={() => {
            setMoveKey((key) => key + 1);
            setMoveOpen(true);
          }}
        >
          {m.items.overview.record}
        </Button>
        <AppLink href={`/${locale}/items/${item.id}`} className={buttonLink(locale, 'secondary')}>
          {m.items.openItem}
        </AppLink>
      </div>
      <section aria-labelledby={`preview-moves-${item.id}`} className="border-t border-line pt-4">
        <h3 id={`preview-moves-${item.id}`} className={cn(ts('ui', locale), 'm-0 mb-3 text-ink-muted')}>
          {m.quickMove.recentMoves}
        </h3>
        {moves.length ? (
          <MovementCards rows={moves} locale={locale} />
        ) : (
          <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>{m.quickMove.noMoves}</p>
        )}
      </section>
      <MoveSheet
        key={`preview-move-${moveKey}`}
        item={item}
        locale={locale}
        role={role}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        onSettled={(change, result) =>
          toast({
            title: result.ok
              ? t('quickMove.saved', {
                  type: m.types[change.type],
                  item: nameIn(item, locale),
                  qty: `${formatSigned(change.quantityBase, locale)} ${unitName(item.baseUnit, locale, change.quantityBase)}`,
                })
              : t('quickMove.failed', { reason: t(result.messageKey as 'errors.unexpected') }),
          })
        }
      />
    </aside>
  );
}
