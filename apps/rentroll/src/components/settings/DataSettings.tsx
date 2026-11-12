'use client';

import { ResetDialog } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { Button, cn, Skeleton, toast, ts } from '@peera/ui';
import { Download, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { rentRoll } from '@/src/client-store/selectors/reports';
import type { StoreState } from '@/src/client-store/store';
import { ReadyGate } from '@/src/components/live/ReadyGate';
import { PageHeader } from '@/src/components/PageHeader';
import { baht, toCsv } from '@/src/domain/csv';
import { translator } from '@/src/i18n';
import { downloadText } from '@/src/lib/download';
import { snapshotDateView } from './selectors';

const periodView = (state: StoreState) =>
  state.snapshotDate ? state.snapshotDate.slice(0, 7) : '';

/**
 * Data (ux-v2/rentroll.md › Settings): the rent roll and the invoices as CSV files that open in Excel with Thai text
 * intact, and resetting the demo. Resetting clears everything this browser saved, the logo included.
 */
export function DataSettings({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <Body locale={locale} />
    </ReadyGate>
  );
}

const CSV_TYPE = 'text/csv;charset=utf-8';

function Body({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const s = m.settings;
  const r = m.reports;
  const period = useStore(periodView);
  const today = useStore(snapshotDateView);
  const [resetOpen, setResetOpen] = useState(false);

  const exportRentRoll = () => {
    if (!period) return;
    const data = getStore().getState().data;
    const rows = rentRoll(data, period, today).map((x) => [
      x.roomNumber,
      x.renterName,
      m.property.status[x.status],
      baht(x.rentSatang),
      baht(x.utilitiesSatang),
      baht(x.billedSatang),
      baht(x.paidSatang),
      baht(x.outstandingSatang),
    ]);
    const csv = toCsv(
      [
        r.cols.room,
        r.cols.tenant,
        r.cols.status,
        r.cols.rent,
        r.cols.utilities,
        r.cols.billed,
        r.cols.paid,
        r.cols.outstanding,
      ],
      rows,
    );
    downloadText(`rentroll-roll-${period}.csv`, csv, CSV_TYPE);
    toast({ title: r.exportCsv });
  };

  const exportInvoices = () => {
    const data = getStore().getState().data;
    const roomOf = new Map(data.contract.map((c) => [c.id, c.roomId]));
    const roomNumber = new Map(data.room.map((room) => [room.id, room.number]));
    const p = m.billing.public;
    const rows = [...data.invoice]
      .sort((a, b) => a.number.localeCompare(b.number))
      .map((invoice) => [
        invoice.number,
        roomNumber.get(roomOf.get(invoice.contractId) ?? '') ?? '',
        invoice.period ?? '',
        invoice.issueDate,
        invoice.dueDate,
        baht(invoice.totalSatang),
        baht(invoice.paidSatang),
        m.billing.status[invoice.status as keyof typeof m.billing.status] ??
          invoice.status,
      ]);
    const csv = toCsv(
      [
        p.number,
        p.room,
        p.period,
        p.issued,
        p.due,
        p.total,
        r.cols.paid,
        r.cols.status,
      ],
      rows,
    );
    downloadText(`rentroll-invoices-${today}.csv`, csv, CSV_TYPE);
    toast({ title: r.exportCsv });
  };

  if (!period) return <Skeleton locale={locale} lines={4} />;

  return (
    <>
      <PageHeader
        locale={locale}
        title={s.pages.data.title}
        description={s.pages.data.body}
      />
      <div className="flex max-w-[40rem] flex-col gap-4">
        <Card locale={locale} title={s.exportTitle} body={s.exportBody}>
          <Button locale={locale} variant="secondary" onClick={exportRentRoll}>
            <Download aria-hidden size={16} strokeWidth={1.75} />
            {s.exportRentRoll}
          </Button>
          <Button locale={locale} variant="secondary" onClick={exportInvoices}>
            <Download aria-hidden size={16} strokeWidth={1.75} />
            {s.exportInvoices}
          </Button>
        </Card>
        <Card locale={locale} title={s.resetTitle} body={s.resetBody}>
          <Button
            locale={locale}
            variant="secondary"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
            {s.resetTitle}
          </Button>
        </Card>
      </div>
      <ResetDialog
        locale={locale}
        open={resetOpen}
        onOpenChange={setResetOpen}
        onReset={async () => {
          await getStore().reset();
        }}
      />
    </>
  );
}

function Card({
  locale,
  title,
  body,
  children,
}: {
  locale: Locale;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-line bg-surface-raised p-4">
      <div>
        <h2 className={cn(ts('title', locale), 'm-0 text-ink')}>{title}</h2>
        <p className={cn(ts('body-sm', locale), 'm-0 mt-1 text-ink-muted')}>
          {body}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}
