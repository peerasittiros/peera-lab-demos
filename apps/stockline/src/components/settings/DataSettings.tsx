'use client';

import { ResetDialog } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { Button, cn, ts } from '@peera/ui';
import { Download, FileUp, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { historyRows } from '../../client-store/history';
import { useStoreInstance, useStoreState } from '../../client-store/hooks';
import {
  categoryViews,
  itemViews,
  supplierViews,
} from '../../client-store/views';
import { nameIn, translator } from '../../i18n';
import { downloadCsv } from '../../lib/download';
import { exportDate, historyCsv, itemsCsv } from '../../lib/export';
import { AppLink } from '../AppLink';
import { PageHeader } from '../PageHeader';
import { buttonLink } from '../styles';

/** Import items, export the item list and the history, and reset the demo. */
export function DataSettings({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const s = m.settings;
  const store = useStoreInstance();
  const { ledger } = useStoreState();
  const [resetOpen, setResetOpen] = useState(false);

  const exportItems = () => {
    if (!ledger) return;
    const categoryName = new Map(
      categoryViews(ledger).map((entry) => [entry.id, nameIn(entry, locale)]),
    );
    const suppliers = new Map(
      supplierViews(ledger).map((entry) => [entry.id, entry.name]),
    );
    const csv = itemsCsv(
      itemViews(ledger, 'owner', { includeInactive: true }),
      locale,
      'owner',
      {
        categoryName: (id) => (id ? (categoryName.get(id) ?? '') : ''),
        supplierName: (id) => (id ? (suppliers.get(id) ?? '') : ''),
      },
    );
    downloadCsv(`stockline-items-${exportDate()}.csv`, csv.header, csv.rows);
  };

  const exportHistory = () => {
    if (!ledger) return;
    const csv = historyCsv(
      historyRows(ledger, 'owner', {}).rows,
      locale,
      'owner',
    );
    downloadCsv(`stockline-history-${exportDate()}.csv`, csv.header, csv.rows);
  };

  return (
    <>
      <PageHeader
        locale={locale}
        title={s.pages.data.title}
        description={s.pages.data.body}
      />
      <div className="flex max-w-[40rem] flex-col gap-4">
        <Card locale={locale} title={s.importTitle} body={s.importBody}>
          <AppLink
            href={`/${locale}/import`}
            className={buttonLink(locale, 'secondary')}
          >
            <FileUp aria-hidden size={16} strokeWidth={1.75} />
            {s.importOpen}
          </AppLink>
        </Card>
        <Card locale={locale} title={s.exportTitle} body={s.exportBody}>
          <Button
            locale={locale}
            variant="secondary"
            disabled={!ledger}
            onClick={exportItems}
          >
            <Download aria-hidden size={16} strokeWidth={1.75} />
            {s.exportItems}
          </Button>
          <Button
            locale={locale}
            variant="secondary"
            disabled={!ledger}
            onClick={exportHistory}
          >
            <Download aria-hidden size={16} strokeWidth={1.75} />
            {s.exportHistory}
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
          await store?.reset();
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
