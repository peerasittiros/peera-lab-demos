'use client';

import { useRole } from '../client-store/role';
import { formatMoney, type Locale } from '@peera/i18n';
import {
  Button,
  cn,
  EmptyState,
  focusRing,
  Skeleton,
  Table,
  ts,
  type TableColumn,
} from '@peera/ui';
import { Download } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useMedia } from '../lib/use-media';
import { useItemViews, useStoreState } from '../client-store/hooks';
import {
  categoryViews,
  filterItems,
  supplierViews,
  type ItemFilters,
} from '../client-store/views';
import type { ItemView } from '../domain/read-models';
import { stockValue, type ItemStatus, type Role } from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { formatQty } from '../lib/format';
import { downloadCsv } from '../lib/download';
import { exportDate, itemsCsv } from '../lib/export';
import { AppLink } from './AppLink';
import { ItemPreview } from './ItemPreview';
import { ItemRowContent, ItemThumb } from './ItemRow';
import { ItemStatusBadge } from './ItemStatusBadge';
import { buttonLink } from './styles';
import { UrlFilters } from './UrlFilters';

const STATUSES: ItemStatus[] = ['low', 'out', 'ok'];

function param(value: string | null): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

function filtersFrom(params: URLSearchParams): ItemFilters {
  const status = param(params.get('status')) as ItemStatus | undefined;
  return {
    query: param(params.get('q')),
    categoryId: param(params.get('category')),
    supplierId: param(params.get('supplier')),
    status: status && STATUSES.includes(status) ? status : undefined,
    archived: params.get('archived') === '1',
  };
}

/** The items list (02 §8 screen 3): filters in the URL, a table on desktop and cards on a phone. */
export function ItemsList({ locale }: { locale: Locale }) {
  const role = useRole();
  return (
    <Suspense fallback={<Skeleton locale={locale} lines={6} />}>
      <ItemsListBody locale={locale} role={role} />
    </Suspense>
  );
}

function ItemsListBody({ locale, role }: { locale: Locale; role: Role }) {
  const { tp, m } = translator(locale);
  const params = useSearchParams();
  const filters = filtersFrom(params);
  const { ledger, status } = useStoreState();
  const views = useItemViews(role, { includeInactive: true });
  // Columns fit the room: the 768 rail, the 1024 sidebar, and from 1280 a detail pane beside the table (V4).
  const md = useMedia('(min-width: 768px)');
  const lg = useMedia('(min-width: 1024px)');
  const wide = useMedia('(min-width: 1280px)');
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (!ledger || status === 'loading')
    return <Skeleton locale={locale} lines={6} />;

  const categories = categoryViews(ledger);
  const suppliers = supplierViews(ledger);
  const categoryName = new Map(
    categories.map((entry) => [entry.id, nameIn(entry, locale)]),
  );
  const items = filterItems(views, filters);
  const owner = role === 'owner';
  const linkClass = cn(
    ts('ui', locale),
    'text-ink underline-offset-4 hover:underline',
    focusRing,
  );

  const columns: TableColumn<ItemView>[] = [
    {
      key: 'name',
      header: m.items.columns.name,
      cell: (row) => (
        <span className="flex items-center gap-3">
          <ItemThumb item={row} size={32} />
          <span className="flex min-w-0 flex-col">
            <AppLink
              href={`/${locale}/items/${row.id}`}
              className={linkClass}
              onClick={(event) => {
                // From 1280 the name opens the detail pane; the page stays put.
                if (!wide) return;
                event.preventDefault();
                setPreviewId(row.id);
              }}
            >
              {nameIn(row, locale)}
            </AppLink>
            <span className="code text-ink-muted">{row.sku}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'category',
      header: m.items.columns.category,
      cell: (row) =>
        row.categoryId ? categoryName.get(row.categoryId) : m.common.noCategory,
    },
    {
      key: 'onHand',
      header: m.items.columns.onHand,
      numeric: true,
      cell: (row) => (
        <span className="num text-base whitespace-nowrap">
          {formatQty(row.onHand, row.baseUnit, locale)}
        </span>
      ),
    },
    {
      key: 'min',
      header: m.items.columns.min,
      numeric: true,
      cell: (row) => formatQty(row.minQty, null, locale),
    },
    {
      key: 'status',
      header: m.items.columns.status,
      cell: (row) => (
        <span className="whitespace-nowrap">
          <ItemStatusBadge
            status={row.status}
            archived={!row.active}
            locale={locale}
          />
        </span>
      ),
    },
    {
      key: 'location',
      header: m.items.columns.location,
      cell: (row) => row.location ?? '',
    },
    ...(owner
      ? ([
          {
            key: 'cost',
            header: m.items.columns.cost,
            numeric: true,
            cell: (row) =>
              row.costSatang == null ? '' : formatMoney(row.costSatang, locale),
          },
          {
            key: 'value',
            header: m.items.columns.value,
            numeric: true,
            cell: (row) =>
              formatMoney(
                stockValue(row.onHand, row.costSatang ?? null),
                locale,
              ),
          },
        ] satisfies TableColumn<ItemView>[])
      : []),
  ];

  const filterFields: Parameters<typeof UrlFilters>[0]['fields'] = [
    {
      kind: 'search',
      name: 'q',
      label: m.items.searchLabel,
      placeholder: m.quickMove.searchPlaceholder,
    },
    {
      kind: 'select',
      name: 'category',
      label: m.items.filterCategory,
      allLabel: m.common.all,
      options: categories.map((entry) => ({
        value: entry.id,
        label: nameIn(entry, locale),
      })),
    },
    {
      kind: 'select',
      name: 'supplier',
      label: m.items.filterSupplier,
      allLabel: m.common.all,
      options: suppliers.map((entry) => ({
        value: entry.id,
        label: entry.name,
      })),
    },
    {
      kind: 'select',
      name: 'status',
      label: m.items.filterStatus,
      allLabel: m.items.statusAll,
      options: STATUSES.map((value) => ({
        value,
        label: m.status[value],
      })),
    },
    ...(owner
      ? [
          {
            kind: 'checkbox' as const,
            name: 'archived',
            label: m.items.filterArchived,
          },
        ]
      : []),
  ];

  const keep = wide
    ? ['name', 'onHand', 'status', 'value']
    : lg
      ? ['name', 'category', 'onHand', 'min', 'status', 'value']
      : ['name', 'category', 'onHand', 'status'];
  const shown = columns.filter((column) => keep.includes(column.key));
  const preview = wide
    ? (items.find((row) => row.id === previewId) ?? items[0] ?? null)
    : null;
  const statusHref = (value?: ItemStatus) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set('status', value);
    else next.delete('status');
    const query = next.toString();
    return `/${locale}/items${query ? `?${query}` : ''}`;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
          {tp('common.itemsCount', items.length)}
        </p>
        <Button
          locale={locale}
          variant="secondary"
          size="sm"
          onClick={() => {
            const csv = itemsCsv(items, locale, role, {
              categoryName: (id) => (id ? (categoryName.get(id) ?? '') : ''),
              supplierName: (id) =>
                id
                  ? (suppliers.find((entry) => entry.id === id)?.name ?? '')
                  : '',
            });
            downloadCsv(
              `stockline-items-${exportDate()}.csv`,
              csv.header,
              csv.rows,
            );
          }}
        >
          <Download aria-hidden size={16} strokeWidth={1.75} />
          {m.common.exportCsv}
        </Button>
      </div>
      {md ? (
        <UrlFilters
          locale={locale}
          clearLabel={m.items.clearFilters}
          className="mb-5"
          fields={filterFields}
        />
      ) : (
        // Phones: search and the status chips stay in view; the other filters fold away.
        <div className="mb-4 flex flex-col gap-3">
          <UrlFilters
            locale={locale}
            clearLabel={m.items.clearFilters}
            fields={filterFields.filter((field) => field.name === 'q')}
          />
          <details className="rounded-md border border-line bg-surface-raised px-3">
            <summary
              className={cn(
                ts('ui', locale),
                'flex min-h-11 cursor-pointer items-center text-ink',
              )}
            >
              {m.items.moreFilters}
            </summary>
            <UrlFilters
              locale={locale}
              clearLabel={m.items.clearFilters}
              className="pb-3"
              fields={filterFields.filter(
                (field) => field.name !== 'q' && field.name !== 'status',
              )}
            />
          </details>
        </div>
      )}
      {/* Phones: status chips that scroll sideways, one tap per filter. */}
      <nav
        aria-label={m.items.filterStatus}
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden"
      >
        {([undefined, ...STATUSES] as (ItemStatus | undefined)[]).map(
          (value) => (
            <AppLink
              key={value ?? 'all'}
              href={statusHref(value)}
              aria-current={filters.status === value ? 'true' : undefined}
              className={cn(
                ts('ui', locale),
                'inline-flex min-h-11 shrink-0 items-center rounded-full border border-line-strong bg-surface-raised px-4 whitespace-nowrap text-ink',
                'aria-[current=true]:border-primary aria-[current=true]:bg-primary-soft aria-[current=true]:text-primary',
                focusRing,
              )}
            >
              {value ? m.status[value] : m.items.statusAll}
            </AppLink>
          ),
        )}
      </nav>
      {items.length === 0 ? (
        <EmptyState locale={locale} title={m.items.noMatches} />
      ) : (
        <div
          className={cn(
            preview && 'grid grid-cols-[minmax(0,1fr)_24rem] items-start gap-6',
          )}
        >
          {/* Only the layout that fits is rendered: a hidden one would still cost a render and a layout. */}
          {md ? (
            <div className="hidden min-w-0 overflow-hidden rounded-md border border-line bg-surface-raised md:block">
              <Table
                locale={locale}
                columns={shown}
                rows={items}
                rowKey={(row) => row.id}
              />
            </div>
          ) : (
            <ul
              className={cn(
                'sl-stagger m-0 grid list-none gap-2 p-0 md:hidden',
                owner && 'pb-20',
              )}
            >
              {items.map((row) => (
                <li key={row.id}>
                  <AppLink
                    href={`/${locale}/items/${row.id}`}
                    className={cn(
                      'flex min-h-[4.5rem] items-center rounded-md border border-line bg-surface-raised px-3 py-3 hover:bg-surface-sunken',
                      focusRing,
                    )}
                  >
                    <ItemRowContent item={row} locale={locale} emphasis />
                  </AppLink>
                </li>
              ))}
            </ul>
          )}
          {preview ? (
            <ItemPreview
              key={preview.id}
              item={preview}
              locale={locale}
              role={role}
            />
          ) : null}
        </div>
      )}
      {/* Phones: Add item stays in reach above the tab bar (owner only). */}
      {owner ? (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface-raised px-4 py-3 md:hidden">
          <AppLink
            href={`/${locale}/items/new`}
            className={cn(
              buttonLink(locale, 'primary'),
              'w-full justify-center',
            )}
          >
            {m.items.add}
          </AppLink>
        </div>
      ) : null}
    </>
  );
}
