'use client';

import type { Locale } from '@peera/i18n';
import { Button, cn, focusRing, toast } from '@peera/ui';
import { useCallback, useState } from 'react';
import { useStore } from '@/src/client-store/hooks';
import {
  depositsReport,
  rentRoll,
  utilitiesReport,
} from '@/src/client-store/selectors/reports';
import type { StoreState } from '@/src/client-store/store';
import { baht, toCsv } from '@/src/domain/csv';
import { addMonths } from '@/src/domain/dates';
import { translator, type Messages } from '@/src/i18n';
import { PageHeader } from '@/src/components/PageHeader';
import { ReadyGate } from './ReadyGate';

const periodOf = (s: StoreState) =>
  s.snapshotDate ? s.snapshotDate.slice(0, 7) : '';
const todayOf = (s: StoreState) => s.snapshotDate ?? '';


type ReportKind = 'rent-roll' | 'utilities' | 'deposits';

/** One report for a month (rent roll, utilities) or all time (deposits). Print, and download as CSV. */
export function ReportLive({
  locale,
  report,
}: {
  locale: Locale;
  report: ReportKind;
}) {
  return (
    <ReadyGate locale={locale}>
      <ReportBody locale={locale} report={report} />
    </ReadyGate>
  );
}

function ReportBody({
  locale,
  report,
}: {
  locale: Locale;
  report: ReportKind;
}) {
  const { m } = translator(locale);
  const current = useStore(periodOf);
  const today = useStore(todayOf);
  const [period, setPeriod] = useState<string | null>(null);
  const month = period ?? current;
  const months = current
    ? Array.from({ length: 12 }, (_, k) => addMonths(current, -k))
    : [];
  const r = m.reports;

  if (!current) return null;
  return (
    <>
      <PageHeader
        locale={locale}
        title={titleOf(m, report)}
        description={introOf(m, report)}
      />
      {report !== 'deposits' ? (
        <nav aria-label={r.period} className="mb-4 flex flex-wrap gap-2">
          {months.map((mo) => (
            <button
              key={mo}
              type="button"
              aria-pressed={mo === month}
              onClick={() => setPeriod(mo)}
              className={cn(
                'inline-flex min-h-11 items-center rounded-sm border px-3 tabular-nums text-ink',
                mo === month
                  ? 'border-ink bg-surface-sunken'
                  : 'border-line bg-surface-raised',
                focusRing,
              )}
            >
              {mo}
            </button>
          ))}
        </nav>
      ) : null}
      <ReportTable
        locale={locale}
        m={m}
        report={report}
        period={month}
        today={today}
      />
    </>
  );
}

function titleOf(m: Messages, report: ReportKind) {
  return report === 'rent-roll'
    ? m.reports.rentRoll.title
    : report === 'utilities'
      ? m.reports.utilities.title
      : m.reports.deposits.title;
}

function introOf(m: Messages, report: ReportKind) {
  return report === 'rent-roll'
    ? m.reports.rentRoll.intro
    : report === 'utilities'
      ? m.reports.utilities.intro
      : m.reports.deposits.intro;
}

function ReportTable({
  locale,
  m,
  report,
  period,
  today,
}: {
  locale: Locale;
  m: Messages;
  report: ReportKind;
  period: string;
  today: string;
}) {
  const r = m.reports;
  const c = r.cols;
  const rentSelect = useCallback(
    (s: StoreState) =>
      report === 'rent-roll' ? rentRoll(s.data, period, today) : [],
    [report, period, today],
  );
  const utilSelect = useCallback(
    (s: StoreState) =>
      report === 'utilities' ? utilitiesReport(s.data, period) : [],
    [report, period],
  );
  const depSelect = useCallback(
    (s: StoreState) => (report === 'deposits' ? depositsReport(s.data) : []),
    [report],
  );
  const rentRows = useStore(rentSelect);
  const utils = useStore(utilSelect);
  const deposits = useStore(depSelect);

  // One table of text cells: what is shown and what goes into the CSV are the same.
  const header: string[] =
    report === 'rent-roll'
      ? [
          c.room,
          c.tenant,
          c.status,
          c.rent,
          c.utilities,
          c.billed,
          c.paid,
          c.outstanding,
        ]
      : report === 'utilities'
        ? [c.room, c.electricityUnits, c.electricity, c.waterUnits, c.water]
        : [c.room, c.tenant, c.deposit, c.received, c.settled, c.refund];
  const rows: (string | number | null)[][] =
    report === 'rent-roll'
      ? rentRows.map((x) => [
          x.roomNumber,
          x.renterName,
          m.property.status[x.status],
          baht(x.rentSatang),
          baht(x.utilitiesSatang),
          baht(x.billedSatang),
          baht(x.paidSatang),
          baht(x.outstandingSatang),
        ])
      : report === 'utilities'
        ? utils.map((x) => [
            x.roomNumber,
            x.electricityUnits,
            baht(x.electricitySatang),
            x.waterUnits,
            baht(x.waterSatang),
          ])
        : deposits.map((x) => [
            x.roomNumber,
            x.renterName,
            baht(x.depositSatang),
            baht(x.receivedSatang),
            x.settled ? r.yes : r.no,
            x.refundSatang === null ? null : baht(x.refundSatang),
          ]);
  const totals = totalsOf(report, rows, r.total);

  const download = () => {
    const csv = toCsv(header, totals ? [...rows, totals] : rows);
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report}-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: r.exportCsv });
  };

  if (rows.length === 0) return <p className="text-ink-muted">{r.empty}</p>;
  return (
    <>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          locale={locale}
          onClick={download}
        >
          {r.exportCsv}
        </Button>
        <Button
          type="button"
          variant="ghost"
          locale={locale}
          onClick={() => window.print()}
        >
          {r.print}
        </Button>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              {header.map((h) => (
                <th key={h} scope="col" className="py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-line odd:bg-surface-sunken"
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={cn(
                      'py-2 pr-4 tabular-nums text-ink',
                      j > 0 && 'text-right',
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals ? (
            <tfoot>
              <tr className="border-t-2 border-line font-semibold">
                {totals.map((cell, j) => (
                  <td
                    key={j}
                    className={cn(
                      'py-2 pr-4 tabular-nums text-ink',
                      j > 0 && 'text-right',
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
        {rows.map((row, i) => (
          <li
            key={i}
            className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4"
          >
            <span className="text-ink">{row[0]}</span>
            <dl className="m-0 flex flex-col gap-1">
              {row.slice(1).map((cell, j) => (
                <div key={j} className="flex justify-between gap-4">
                  <dt className="text-ink-muted">{header[j + 1]}</dt>
                  <dd className="m-0 text-right tabular-nums text-ink">
                    {cell}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
        {totals ? (
          <li className="flex flex-col gap-2 rounded-sm border-2 border-line p-4">
            <span className="font-semibold text-ink">{totals[0]}</span>
            <dl className="m-0 flex flex-col gap-1">
              {totals.slice(1).map((cell, j) =>
                cell === '' ? null : (
                  <div key={j} className="flex justify-between gap-4">
                    <dt className="text-ink-muted">{header[j + 1]}</dt>
                    <dd className="m-0 text-right font-semibold tabular-nums text-ink">
                      {cell}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </li>
        ) : null}
      </ul>
    </>
  );
}

/** The totals row: money columns are summed; the others are left empty. Null when the report has no totals. */
function totalsOf(
  report: ReportKind,
  rows: (string | number | null)[][],
  label: string,
): (string | number | null)[] | null {
  if (report === 'deposits' || rows.length === 0) return null;
  const sum = (col: number) =>
    rows.reduce((s, row) => s + Number(row[col] ?? 0), 0);
  if (report === 'rent-roll') {
    return [
      label,
      '',
      '',
      baht(sumSatang(rows, 3)),
      baht(sumSatang(rows, 4)),
      baht(sumSatang(rows, 5)),
      baht(sumSatang(rows, 6)),
      baht(sumSatang(rows, 7)),
    ];
  }
  return [
    label,
    sum(1),
    baht(sumSatang(rows, 2)),
    sum(3),
    baht(sumSatang(rows, 4)),
  ];
}

function sumSatang(rows: (string | number | null)[][], col: number): number {
  return Math.round(
    rows.reduce((s, row) => s + Number(row[col] ?? 0) * 100, 0),
  );
}
