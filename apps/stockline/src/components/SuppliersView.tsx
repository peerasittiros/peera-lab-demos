'use client';

import { formatPhone, type Locale } from '@peera/i18n';
import {
  cn,
  EmptyState,
  Skeleton,
  Table,
  ts,
  type TableColumn,
} from '@peera/ui';
import { useItemViews, useStoreState } from '../client-store/hooks';
import { supplierViews } from '../client-store/views';
import { translator } from '../i18n';
import { PageHeader } from './PageHeader';
import { SupplierEditor } from './MasterData';

type SupplierRow = ReturnType<typeof supplierViews>[number] & {
  itemCount: number;
};

function phone(value: string | null) {
  if (!value) return '';
  try {
    return formatPhone(value);
  } catch {
    return value;
  }
}

/** Suppliers (02 §8 owner screen): a table on desktop, cards on a phone. Reads the browser store. */
export function SuppliersView({ locale }: { locale: Locale }) {
  const { tp, m } = translator(locale);
  const { ledger, status } = useStoreState();
  const items = useItemViews('owner', { includeInactive: true });

  if (!ledger || status === 'loading')
    return <Skeleton locale={locale} lines={6} />;
  const suppliers: SupplierRow[] = supplierViews(ledger).map((row) => ({
    ...row,
    itemCount: items.filter((item) => item.supplierId === row.id).length,
  }));

  const columns: TableColumn<SupplierRow>[] = [
    {
      key: 'name',
      header: m.suppliers.columns.name,
      cell: (row) => (
        <span className="flex flex-col">
          <span className="text-ink">{row.name}</span>
          {row.note ? <span className="text-ink-muted">{row.note}</span> : null}
        </span>
      ),
    },
    {
      key: 'contact',
      header: m.suppliers.columns.contact,
      cell: (row) => row.contactName ?? '',
    },
    {
      key: 'phone',
      header: m.suppliers.columns.phone,
      cell: (row) =>
        row.phone ? (
          <a
            href={`tel:${row.phone}`}
            className="whitespace-nowrap text-ink underline-offset-4 hover:underline"
          >
            {phone(row.phone)}
          </a>
        ) : (
          ''
        ),
    },
    {
      key: 'line',
      header: m.suppliers.columns.line,
      cell: (row) => row.lineId ?? '',
    },
    {
      key: 'lead',
      header: m.suppliers.columns.leadTime,
      numeric: true,
      cell: (row) => tp('common.days', row.leadTimeDays),
    },
    {
      key: 'items',
      header: m.suppliers.columns.items,
      numeric: true,
      cell: (row) => tp('common.itemsCount', row.itemCount),
    },
    {
      key: 'edit',
      header: <span className="sr-only">{m.common.actions}</span>,
      cell: (row) => <SupplierEditor locale={locale} supplier={row} />,
    },
  ];

  return (
    <>
      <PageHeader
        locale={locale}
        title={m.suppliers.title}
        description={m.suppliers.subtitle}
        actions={<SupplierEditor locale={locale} />}
      />
      {suppliers.length === 0 ? (
        <EmptyState
          locale={locale}
          title={m.suppliers.emptyTitle}
          description={m.suppliers.emptyBody}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-sm border border-line bg-surface-raised lg:block">
            <Table
              locale={locale}
              columns={columns}
              rows={suppliers}
              rowKey={(row) => row.id}
            />
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden">
            {suppliers.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 rounded-sm border border-line bg-surface-raised p-3"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={cn(ts('ui', locale), 'text-ink')}>
                    {row.name}
                  </span>
                  <SupplierEditor locale={locale} supplier={row} />
                </span>
                <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                  {[
                    row.contactName,
                    phone(row.phone),
                    row.lineId && `LINE ${row.lineId}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                  {`${m.suppliers.columns.leadTime} ${tp('common.days', row.leadTimeDays)} · ${tp('common.itemsCount', row.itemCount)}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
