import { formatDateTime, formatMoney, type Locale } from '@peera/i18n';
import { cn, Table, ts, type TableColumn } from '@peera/ui';
import { ArrowDownLeft, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import type { MovementView } from '../domain/read-models';
import type { MovementType } from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { formatQty, formatSigned, unitName } from '../lib/format';
import { AppLink } from './AppLink';

const typeStyle: Record<
  MovementType,
  { Icon: typeof ArrowDownLeft; className: string }
> = {
  in: { Icon: ArrowDownLeft, className: 'bg-success-soft text-success' },
  out: { Icon: ArrowUpRight, className: 'bg-surface-sunken text-ink' },
  adjust: {
    Icon: SlidersHorizontal,
    className: 'bg-warning-soft text-warning',
  },
};

/** In / Out / Adjust as icon + word (02 §8 screen 6: `+` green, `−` ink, adjust amber; never color alone). */
export function MovementTypeTag({
  type,
  locale,
}: {
  type: MovementType;
  locale: Locale;
}) {
  const { m } = translator(locale);
  const { Icon, className } = typeStyle[type];
  return (
    <span
      className={cn(
        ts('ui', locale),
        'inline-flex min-h-7 items-center gap-1.5 rounded-xs px-2 py-1',
        className,
      )}
    >
      <Icon aria-hidden size={16} strokeWidth={1.75} />
      {m.types[type]}
    </span>
  );
}

function SignedQty({ row, locale }: { row: MovementView; locale: Locale }) {
  const { m } = translator(locale);
  return (
    <span className="num whitespace-nowrap">
      <span className="sr-only">
        {row.quantityBase > 0 ? m.history.plus : m.history.minus}{' '}
      </span>
      <span aria-hidden>{formatSigned(row.quantityBase, locale)}</span>
      <span className="sr-only">
        {formatQty(Math.abs(row.quantityBase), null, locale)}
      </span>{' '}
      {unitName(row.item.baseUnit, locale, row.quantityBase)}
    </span>
  );
}

function entered(row: MovementView, locale: Locale): string | null {
  if (
    !row.enteredUnit ||
    row.enteredUnit.id === row.item.baseUnit.id ||
    row.enteredQty == null
  )
    return null;
  return formatQty(row.enteredQty, row.enteredUnit, locale);
}

/** Timeline cards (phones, and the item page's history tab). */
export function MovementCards({
  rows,
  locale,
  showItem = true,
}: {
  rows: MovementView[];
  locale: Locale;
  showItem?: boolean;
}) {
  const { t, m } = translator(locale);
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-sm border border-line bg-surface-raised p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              {showItem ? (
                <AppLink
                  href={`/${locale}/items/${row.item.id}`}
                  className={cn(
                    ts('ui', locale),
                    'text-ink underline-offset-4 hover:underline',
                  )}
                >
                  {nameIn(row.item, locale)}
                </AppLink>
              ) : null}
              <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                {formatDateTime(row.occurredAt, locale)}
                {row.userName
                  ? ` · ${t('items.history.by', { name: row.userName })}`
                  : ''}
              </span>
            </div>
            <MovementTypeTag type={row.type} locale={locale} />
          </div>
          <dl
            className={cn(
              ts('body-sm', locale),
              'mt-2 mb-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1',
            )}
          >
            <dt className="text-ink-muted">{m.history.columns.quantity}</dt>
            <dd className="m-0 text-ink">
              <SignedQty row={row} locale={locale} />
              {entered(row, locale) ? (
                <span className="text-ink-muted">{` (${entered(row, locale)})`}</span>
              ) : null}
            </dd>
            <dt className="text-ink-muted">{m.history.columns.balance}</dt>
            <dd className="m-0 tabular-nums text-ink">
              {formatQty(row.balanceAfter, row.item.baseUnit, locale)}
            </dd>
            <dt className="text-ink-muted">{m.history.columns.reason}</dt>
            <dd className="m-0 text-ink">
              {m.reasons[row.reason as keyof typeof m.reasons] ?? row.reason}
              {row.reference ? (
                <span className="code text-ink-muted">{` · ${row.reference}`}</span>
              ) : null}
            </dd>
            {row.note ? (
              <>
                <dt className="text-ink-muted">{m.quickMove.note}</dt>
                <dd className="m-0 text-ink">{row.note}</dd>
              </>
            ) : null}
          </dl>
        </li>
      ))}
    </ol>
  );
}

/** The ledger table (desktop). */
export function MovementTable({
  rows,
  locale,
  owner,
}: {
  rows: MovementView[];
  locale: Locale;
  owner: boolean;
}) {
  const { m } = translator(locale);
  const columns: TableColumn<MovementView>[] = [
    {
      key: 'time',
      header: m.history.columns.time,
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatDateTime(row.occurredAt, locale)}
        </span>
      ),
    },
    {
      key: 'item',
      header: m.history.columns.item,
      cell: (row) => (
        <span className="flex flex-col">
          <AppLink
            href={`/${locale}/items/${row.item.id}`}
            className="text-ink underline-offset-4 hover:underline"
          >
            {nameIn(row.item, locale)}
          </AppLink>
          <span className="code text-ink-muted">{row.item.sku}</span>
        </span>
      ),
    },
    {
      key: 'type',
      header: m.history.columns.type,
      cell: (row) => <MovementTypeTag type={row.type} locale={locale} />,
    },
    {
      key: 'qty',
      header: m.history.columns.quantity,
      numeric: true,
      cell: (row) => <SignedQty row={row} locale={locale} />,
    },
    {
      key: 'entered',
      header: m.history.columns.entered,
      cell: (row) => entered(row, locale) ?? '',
    },
    {
      key: 'balance',
      header: m.history.columns.balance,
      numeric: true,
      cell: (row) => formatQty(row.balanceAfter, null, locale),
    },
    {
      key: 'reason',
      header: m.history.columns.reason,
      cell: (row) => (
        <span className="flex flex-col">
          <span>
            {m.reasons[row.reason as keyof typeof m.reasons] ?? row.reason}
          </span>
          {row.note ? <span className="text-ink-muted">{row.note}</span> : null}
        </span>
      ),
    },
    {
      key: 'reference',
      header: m.history.columns.reference,
      cell: (row) =>
        row.reference ? <span className="code">{row.reference}</span> : '',
    },
    {
      key: 'user',
      header: m.history.columns.user,
      cell: (row) => row.userName ?? '',
    },
    ...(owner
      ? ([
          {
            key: 'cost',
            header: m.csv.history.unitCost,
            numeric: true,
            cell: (row) =>
              row.unitCostSatang == null
                ? ''
                : formatMoney(row.unitCostSatang, locale),
          },
        ] satisfies TableColumn<MovementView>[])
      : []),
  ];
  return (
    <Table
      locale={locale}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
    />
  );
}
