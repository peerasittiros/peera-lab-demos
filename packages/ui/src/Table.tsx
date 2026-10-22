import type { ReactNode } from 'react';
import { cn } from './cn';
import { ts, type Locale } from './i18n';

export type TableColumn<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Aligns numeric values to the end and enables tabular figures. */
  numeric?: boolean;
  /** Optional label used for this value in the mobile card layout. */
  cardLabel?: ReactNode;
};

export type TableProps<Row> = {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  locale: Locale;
  /** Render a stacked card layout on small screens. */
  collapseOnMobile?: boolean;
  /** Forces the responsive card/table view for tests or a containing layout. */
  mobileView?: boolean;
  className?: string;
};

/** Accessible data table with an optional mobile card layout. */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  locale,
  collapseOnMobile = false,
  mobileView,
  className,
}: TableProps<Row>) {
  const showCards = collapseOnMobile && mobileView === true;
  const tableVisibility = collapseOnMobile
    ? showCards
      ? 'hidden'
      : 'hidden md:table'
    : 'table';
  const cardsVisibility = showCards ? 'block' : 'md:hidden';

  return (
    <div
      lang={locale}
      className={cn(ts('body-sm', locale), 'w-full', className)}
    >
      <div className="w-full overflow-x-auto">
        <table
          className={cn('w-full border-collapse text-left', tableVisibility)}
        >
          <thead className="sticky top-0 z-10 bg-surface-raised">
            <tr className="border-b border-line-strong">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-3 py-2 font-medium text-ink-muted',
                    column.numeric && 'text-right tabular-nums',
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-line last:border-b-0"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-3 text-ink',
                      column.numeric && 'text-right tabular-nums',
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {collapseOnMobile && (
        <div className={cn('space-y-3', cardsVisibility)}>
          {rows.map((row) => (
            <article
              key={rowKey(row)}
              className="rounded-sm border border-line bg-surface-raised p-3"
            >
              <dl className="grid gap-2">
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className={cn(
                      'flex items-start justify-between gap-4',
                      column.numeric && 'tabular-nums',
                    )}
                  >
                    <dt className="text-ink-muted">
                      {column.cardLabel ?? column.header}
                    </dt>
                    <dd
                      className={cn(
                        'm-0 text-ink',
                        column.numeric && 'text-right',
                      )}
                    >
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
