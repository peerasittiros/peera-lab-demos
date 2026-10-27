'use client';

import { useRole } from '../client-store/role';
import { formatDate, type Locale } from '@peera/i18n';
import {
  cn,
  EmptyState,
  focusRing,
  Skeleton,
  Table,
  ts,
  type TableColumn,
} from '@peera/ui';
import { orderViews, type OrderView } from '../client-store/views';
import { useStoreState } from '../client-store/hooks';
import { useMedia } from '../lib/use-media';
import { translator } from '../i18n';
import { AppLink } from './AppLink';
import { OrderStatusBadge } from './OrderParts';
import { PageHeader } from './PageHeader';
import { buttonLink } from './styles';

/** Purchase orders (02 §8 screen 5): a table on desktop, cards on a phone. Reads the browser store. */
export function OrdersView({ locale }: { locale: Locale }) {
  const role = useRole();
  const { tp, m } = translator(locale);
  const { ledger, status } = useStoreState();
  const md = useMedia('(min-width: 768px)');
  const date = (value: Date | null) => (value ? formatDate(value, locale) : '');

  // The heading is in the server HTML; only the body waits for the store (it is the page's LCP text).
  if (!ledger || status === 'loading')
    return (
      <>
        <PageHeader
          locale={locale}
          title={m.orders.title}
          description={m.orders.subtitle}
        />
        <Skeleton locale={locale} lines={6} />
      </>
    );
  const orders = orderViews(ledger, role);

  const columns: TableColumn<OrderView>[] = [
    {
      key: 'number',
      header: m.orders.columns.number,
      cell: (row) => (
        <AppLink
          href={`/${locale}/orders/${row.id}`}
          className={cn(
            'code text-ink underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          {row.number}
        </AppLink>
      ),
    },
    {
      key: 'supplier',
      header: m.orders.columns.supplier,
      cell: (row) => row.supplierName ?? m.common.noSupplier,
    },
    {
      key: 'status',
      header: m.orders.columns.status,
      cell: (row) => <OrderStatusBadge status={row.status} locale={locale} />,
    },
    {
      key: 'ordered',
      header: m.orders.columns.ordered,
      cell: (row) => date(row.orderedAt),
    },
    {
      key: 'expected',
      header: m.orders.columns.expected,
      cell: (row) =>
        row.status === 'received' ? date(row.receivedAt) : date(row.expectedAt),
    },
    {
      key: 'lines',
      header: m.orders.columns.lines,
      numeric: true,
      cell: (row) => tp('common.linesCount', row.lines),
    },
  ];

  return (
    <>
      <PageHeader
        locale={locale}
        title={m.orders.title}
        description={m.orders.subtitle}
      />
      {orders.length === 0 ? (
        <EmptyState
          locale={locale}
          title={m.orders.emptyTitle}
          description={m.orders.emptyBody}
          action={
            <AppLink
              href={`/${locale}/reorder`}
              className={buttonLink(locale, 'secondary', 'mt-2')}
            >
              {m.orders.toReorder}
            </AppLink>
          }
        />
      ) : (
        <>
          {/* Only the layout that fits is rendered: a hidden one would still cost a render and a layout. */}
          {md ? (
            <div className="hidden overflow-hidden rounded-sm border border-line bg-surface-raised md:block">
              <Table
                locale={locale}
                columns={columns}
                rows={orders}
                rowKey={(row) => row.id}
              />
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
              {orders.map((row) => (
                <li key={row.id}>
                  <AppLink
                    href={`/${locale}/orders/${row.id}`}
                    className={cn(
                      'flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-3 hover:bg-surface-sunken',
                      focusRing,
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="code text-ink">{row.number}</span>
                      <OrderStatusBadge status={row.status} locale={locale} />
                    </span>
                    <span className={cn(ts('ui', locale), 'text-ink')}>
                      {row.supplierName ?? m.common.noSupplier}
                    </span>
                    <span
                      className={cn(ts('body-sm', locale), 'text-ink-muted')}
                    >
                      {`${m.orders.columns.ordered} ${date(row.orderedAt)} · ${tp('common.linesCount', row.lines)}`}
                    </span>
                  </AppLink>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
