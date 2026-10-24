'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { Button, cn, focusRing, toast } from '@peera/ui';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useStore } from '@/src/client-store/hooks';
import {
  dashboard,
  depositsReport,
  rentRoll,
  utilitiesReport,
} from '@/src/client-store/selectors/reports';
import type { StoreState } from '@/src/client-store/store';
import { baht, toCsv } from '@/src/domain/csv';
import { addMonths } from '@/src/domain/dates';
import { translator, type Messages } from '@/src/i18n';
import { PageHeader } from '@/src/components/PageHeader';
import { Dot, KV } from './KV';
import { ReadyGate } from './ReadyGate';

const periodOf = (s: StoreState) =>
  s.snapshotDate ? s.snapshotDate.slice(0, 7) : '';
const todayOf = (s: StoreState) => s.snapshotDate ?? '';

/** The owner's dashboard (SPEC §4 O1): KPIs, twelve months, usage, vacancy and the to-do list. */
export function DashboardLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <DashboardBody locale={locale} />
    </ReadyGate>
  );
}

function DashboardBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.dashboard;
  const select = useCallback(
    (s: StoreState) =>
      s.snapshotDate
        ? dashboard(s.data, s.snapshotDate.slice(0, 7), s.snapshotDate)
        : null,
    [],
  );
  const data = useStore(select);
  if (!data) return null;
  const k = data.kpis;
  const maxBilled = Math.max(1, ...data.revenue.map((r) => r.billedSatang));
  const tiles: { label: string; value: string }[] = [
    {
      label: p.occupancy,
      value:
        k.occupancy === null
          ? m.contracts.blank
          : `${Math.round(k.occupancy * 100)}% · ${k.occupied}/${k.rentable}`,
    },
    { label: p.billed, value: formatMoney(k.billedSatang, locale) },
    { label: p.collected, value: formatMoney(k.collectedSatang, locale) },
    { label: p.outstanding, value: formatMoney(k.outstandingSatang, locale) },
    {
      label: p.overdue,
      value: `${k.overdueCount} · ${formatMoney(k.overdueSatang, locale)}`,
    },
    { label: p.moveOuts, value: String(k.moveOuts30) },
    { label: p.openRepairs, value: String(k.openRepairs) },
  ];
  const todo = [
    {
      label: p.todo.meters,
      count: data.todo.metersMissing,
      href: `/${locale}/owner/meters/current`,
    },
    {
      label: p.todo.slips,
      count: data.todo.slipsWaiting,
      href: `/${locale}/owner/payments/review`,
    },
    {
      label: p.todo.notices,
      count: data.todo.noticesOpen,
      href: `/${locale}/owner/contracts`,
    },
    {
      label: p.todo.overdue,
      count: data.todo.overdueCount,
      href: `/${locale}/owner/overdue`,
    },
    {
      label: p.todo.repairs,
      count: data.todo.openRepairs,
      href: `/${locale}/owner/repairs`,
    },
  ];

  return (
    <>
      <PageHeader locale={locale} title={p.title} description={p.intro} />
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-1 rounded-sm border border-line bg-surface-raised p-4"
          >
            <dt className="text-ink-muted">{t.label}</dt>
            <dd className="tabular-nums text-ink">{t.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-ink">{p.revenue}</h2>
        <ul className="flex flex-col">
          {data.revenue.map((r) => (
            <li
              key={r.period}
              className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 border-b border-line py-2 odd:bg-surface-sunken"
            >
              <span className="tabular-nums text-ink-muted">{r.period}</span>
              <span
                className="block h-3 rounded-sm bg-product-accent"
                style={{
                  width: `${(r.billedSatang / maxBilled) * 100}%`,
                  minWidth: r.billedSatang ? '2px' : '0',
                }}
              />
              <span className="tabular-nums text-ink">
                {formatMoney(r.billedSatang, locale)}
                <span className="ml-2 text-ink-muted">
                  {p.rate}{' '}
                  {r.collectionRate === null
                    ? m.contracts.blank
                    : `${Math.round(r.collectionRate * 100)}%`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4">
          <h2 className="text-ink">{p.todo.title}</h2>
          <ul className="flex flex-col gap-2">
            {todo.map((t) => (
              <li key={t.href} className="flex justify-between gap-3">
                <Link
                  href={t.href}
                  className={cn(
                    'min-h-11 text-ink underline-offset-4 hover:underline',
                    focusRing,
                  )}
                >
                  {t.label}
                </Link>
                <span className="tabular-nums text-ink">{t.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4">
            <h2 className="text-ink">{p.usage}</h2>
            {data.usage.map((u) => (
              <KV key={u.buildingName} label={u.buildingName}>
                <span className="tabular-nums">
                  {u.electricityUnits}
                  <Dot />
                  {u.waterUnits}
                </span>
              </KV>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4">
            <h2 className="text-ink">{p.vacancy}</h2>
            {data.vacancy.length === 0 ? (
              <p className="text-ink-muted">{p.noVacancy}</p>
            ) : null}
            {data.vacancy.map((v) => (
              <KV key={v.roomNumber} label={v.roomNumber}>
                <span className="tabular-nums">
                  {v.days === null ? p.never : `${v.days} ${p.days}`}
                </span>
              </KV>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

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
      <div className="overflow-x-auto">
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
