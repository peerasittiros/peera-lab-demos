'use client';

import { useRole } from '../client-store/role';
import type { Locale } from '@peera/i18n';
import { Button, cn, EmptyState, Skeleton, ts } from '@peera/ui';
import { Download } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useStoreState } from '../client-store/hooks';
import { useMedia } from '../lib/use-media';
import { historyRows, type HistoryFilters } from '../client-store/history';
import { exportDate, historyCsv } from '../lib/export';
import { downloadCsv } from '../lib/download';
import { itemViews } from '../client-store/views';
import type { MovementType, Role } from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { AppLink } from './AppLink';
import { MovementCards, MovementTable } from './Movements';
import { PageHeader } from './PageHeader';
import { UrlFilters } from './UrlFilters';
import { buttonLink } from './styles';

const PAGE = 50;
const TYPES: MovementType[] = ['in', 'out', 'adjust'];

function param(value: string | null | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

/** The history (02 §8 screen 6): filters in the URL, a table on desktop and timeline cards on a phone. */
export function HistoryView({ locale }: { locale: Locale }) {
  const role = useRole();
  return (
    <Suspense fallback={<Skeleton locale={locale} lines={6} />}>
      <HistoryBody locale={locale} role={role} />
    </Suspense>
  );
}

function HistoryBody({ locale, role }: { locale: Locale; role: Role }) {
  const { t, m } = translator(locale);
  const params = useSearchParams();
  const { ledger, status } = useStoreState();
  const wide = useMedia('(min-width: 1024px)');
  const type = param(params.get('type') ?? undefined) as
    MovementType | undefined;
  const filters: HistoryFilters = {
    itemId: param(params.get('item') ?? undefined),
    from: param(params.get('from') ?? undefined),
    to: param(params.get('to') ?? undefined),
    type: type && TYPES.includes(type) ? type : undefined,
    userId: param(params.get('user') ?? undefined),
  };
  const pages = Math.min(
    40,
    Math.max(1, Number(param(params.get('page') ?? undefined) ?? 1) || 1),
  );

  // The heading is in the server HTML; only the body waits for the store (it is the page's LCP text).
  if (!ledger || status === 'loading')
    return (
      <>
        <PageHeader
          locale={locale}
          title={m.history.title}
          description={m.history.subtitle}
        />
        <Skeleton locale={locale} lines={6} />
      </>
    );
  const { rows, total } = historyRows(ledger, role, filters, {
    limit: PAGE * pages,
  });
  const all = historyRows(ledger, role, filters);
  const items = itemViews(ledger, role, { includeInactive: true });
  const users = Object.entries(ledger.users) as [
    Role,
    { id: string; displayName: string },
  ][];

  const more = new URLSearchParams(
    [...params.entries()].filter(([key]) => key !== 'page'),
  );
  more.set('page', String(pages + 1));

  const exportCsv = () => {
    const csv = historyCsv(all.rows, locale, role);
    downloadCsv(`stockline-history-${exportDate()}.csv`, csv.header, csv.rows);
  };

  return (
    <>
      <PageHeader
        locale={locale}
        title={m.history.title}
        description={m.history.subtitle}
        actions={
          <Button locale={locale} variant="secondary" onClick={exportCsv}>
            <Download aria-hidden size={16} strokeWidth={1.75} />
            {m.common.exportCsv}
          </Button>
        }
      />
      <UrlFilters
        locale={locale}
        clearLabel={m.items.clearFilters}
        className="mb-5"
        fields={[
          {
            kind: 'select',
            name: 'item',
            label: m.history.item,
            allLabel: m.history.allItems,
            options: items.map((entry) => ({
              value: entry.id,
              label: `${nameIn(entry, locale)} · ${entry.sku}`,
            })),
          },
          { kind: 'date', name: 'from', label: m.history.from },
          { kind: 'date', name: 'to', label: m.history.to },
          {
            kind: 'select',
            name: 'type',
            label: m.history.type,
            allLabel: m.history.allTypes,
            options: TYPES.map((value) => ({ value, label: m.types[value] })),
          },
          {
            kind: 'select',
            name: 'user',
            label: m.history.user,
            allLabel: m.history.allUsers,
            options: users.map(([, user]) => ({
              value: user.id,
              label: user.displayName,
            })),
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          locale={locale}
          title={m.history.emptyTitle}
          description={m.history.emptyBody}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
            {t('common.showing', { shown: rows.length, total })}
          </p>
          {/* Only the layout that fits is rendered: a hidden one would still cost a render and a layout. */}
          {wide ? (
            <div className="hidden overflow-hidden rounded-sm border border-line bg-surface-raised lg:block">
              <MovementTable
                rows={rows}
                locale={locale}
                owner={role === 'owner'}
              />
            </div>
          ) : (
            <div className="lg:hidden">
              <MovementCards rows={rows} locale={locale} />
            </div>
          )}
          {rows.length < total ? (
            <AppLink
              href={`/${locale}/history?${more}`}
              scroll={false}
              className={buttonLink(locale, 'secondary', 'self-start')}
            >
              {m.history.loadMore}
            </AppLink>
          ) : null}
        </div>
      )}
    </>
  );
}
