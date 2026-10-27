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
import { useStoreState } from '../client-store/hooks';
import { useMedia } from '../lib/use-media';
import {
  categoryViews,
  countViews,
  type CountSummaryView,
} from '../client-store/views';
import { nameIn, translator } from '../i18n';
import { AppLink } from './AppLink';
import { CountStatusBadge, StartCountButton } from './CountParts';
import { PageHeader } from './PageHeader';

/** Stock counts (02 §8 screen 5): the list of sessions and the start button. Reads the browser store. */
export function CountsView({ locale }: { locale: Locale }) {
  const role = useRole();
  const { t, m } = translator(locale);
  const { ledger, status } = useStoreState();
  const md = useMedia('(min-width: 768px)');

  // The heading is in the server HTML; only the body waits for the store (it is the page's LCP text).
  if (!ledger || status === 'loading')
    return (
      <>
        <PageHeader
          locale={locale}
          title={m.counts.title}
          description={m.counts.subtitle}
        />
        <Skeleton locale={locale} lines={6} />
      </>
    );
  const counts = countViews(ledger);
  const categories = categoryViews(ledger);
  const scopeLabel = (row: CountSummaryView) =>
    row.categoryName ? nameIn(row.categoryName, locale) : m.counts.scopeAll;

  const columns: TableColumn<CountSummaryView>[] = [
    {
      key: 'number',
      header: m.counts.columns.number,
      cell: (row) => (
        <AppLink
          href={`/${locale}/counts/${row.id}`}
          className={cn(
            'code text-ink underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          {row.number}
        </AppLink>
      ),
    },
    { key: 'scope', header: m.counts.columns.scope, cell: scopeLabel },
    {
      key: 'status',
      header: m.counts.columns.status,
      cell: (row) => <CountStatusBadge status={row.status} locale={locale} />,
    },
    {
      key: 'started',
      header: m.counts.columns.started,
      cell: (row) => formatDate(row.startedAt, locale),
    },
    {
      key: 'progress',
      header: m.counts.columns.progress,
      numeric: true,
      cell: (row) =>
        t('counts.progress', { done: row.counted, total: row.total }),
    },
  ];

  return (
    <>
      <PageHeader
        locale={locale}
        title={m.counts.title}
        description={m.counts.subtitle}
        actions={
          <StartCountButton
            locale={locale}
            role={role}
            categories={categories}
          />
        }
      />
      {counts.length === 0 ? (
        <EmptyState
          locale={locale}
          title={m.counts.emptyTitle}
          description={m.counts.emptyBody}
        />
      ) : (
        <>
          {/* Only the layout that fits is rendered: a hidden one would still cost a render and a layout. */}
          {md ? (
            <div className="hidden overflow-hidden rounded-sm border border-line bg-surface-raised md:block">
              <Table
                locale={locale}
                columns={columns}
                rows={counts}
                rowKey={(row) => row.id}
              />
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
              {counts.map((row) => (
                <li key={row.id}>
                  <AppLink
                    href={`/${locale}/counts/${row.id}`}
                    className={cn(
                      'flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-3 hover:bg-surface-sunken',
                      focusRing,
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="code text-ink">{row.number}</span>
                      <CountStatusBadge status={row.status} locale={locale} />
                    </span>
                    <span className={cn(ts('ui', locale), 'text-ink')}>
                      {scopeLabel(row)}
                    </span>
                    <span
                      className={cn(ts('body-sm', locale), 'text-ink-muted')}
                    >
                      {`${formatDate(row.startedAt, locale)} · ${t('counts.progress', { done: row.counted, total: row.total })}`}
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
