import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, KpiTile, ts } from '@peera/ui';
import Link from 'next/link';
import type { DashboardData, DepositRow, RentRollRow, UtilityRow } from '../../db/queries/reports';
import { translator } from '../../i18n';
import { PrintButton } from '../billing/PrintButton';

const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);

/** The owner's dashboard (01 §8 screen 1): KPI tiles, collection progress, twelve months with a table, to-do. */
export function DashboardView({ locale, data }: { locale: Locale; data: DashboardData }) {
  const { m } = translator(locale);
  const p = m.dashboard;
  const k = data.kpis;
  const progress = k.billedSatang === 0 ? 0 : k.collectedSatang / k.billedSatang;
  const peak = Math.max(1, ...data.revenue.map((r) => r.rentSatang + r.utilitiesSatang));
  const base = `/${locale}`;
  const todo = [
    { label: p.todo.meters, count: data.todo.metersMissing, href: `${base}/owner/meters/current` },
    { label: p.todo.slips, count: data.todo.slipsWaiting, href: `${base}/owner/payments/review` },
    { label: p.todo.notices, count: data.todo.noticesOpen, href: `${base}/owner/contracts` },
    { label: p.todo.overdue, count: data.todo.overdueCount, href: `${base}/owner/overdue` },
    { label: p.todo.repairs, count: data.todo.openRepairs, href: `${base}/owner/repairs` },
  ];
  return (
    <div className="flex flex-col gap-8" lang={locale}>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile locale={locale} label={p.occupancy} value={pct(k.occupancy)} />
        <KpiTile locale={locale} label={p.billed} value={formatMoney(k.billedSatang, locale)} />
        <KpiTile locale={locale} label={p.collected} value={formatMoney(k.collectedSatang, locale)} />
        <KpiTile locale={locale} label={p.outstanding} value={formatMoney(k.outstandingSatang, locale)} />
        <KpiTile locale={locale} label={p.overdue} value={`${k.overdueCount} · ${formatMoney(k.overdueSatang, locale)}`} />
        <KpiTile locale={locale} label={p.moveOuts} value={k.moveOuts30} />
        <KpiTile locale={locale} label={p.openRepairs} value={k.openRepairs} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={cn(ts('title', locale), 'text-ink')}>{p.progress}</h2>
        <div className="h-3 w-full rounded-sm bg-surface-sunken" role="img" aria-label={`${pct(progress)}`}>
          <div className="h-3 rounded-sm bg-ink" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="text-ink-muted">
          <span>{p.rate}</span> <span className="tabular-nums text-ink">{pct(progress)}</span>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={cn(ts('title', locale), 'text-ink')}>{p.revenue}</h2>
        <ul className="flex items-end gap-1 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring" tabIndex={0} aria-label={p.revenue}>
          {data.revenue.map((r) => (
            <li key={r.period} className="flex min-w-[2.5rem] flex-col items-center gap-1">
              <div className="flex h-40 w-6 flex-col-reverse overflow-hidden rounded-sm bg-surface-sunken" aria-hidden="true">
                <div className="bg-ink" style={{ height: `${(r.rentSatang / peak) * 100}%` }} />
                <div className="bg-ink-muted" style={{ height: `${(r.utilitiesSatang / peak) * 100}%` }} />
              </div>
              <span className="text-xs tabular-nums text-ink-muted">{r.period.slice(5)}</span>
            </li>
          ))}
        </ul>
        <table className="w-full border-collapse text-left text-ink">
          <caption className="sr-only">{p.table}</caption>
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th scope="col" className="py-2 font-normal">{m.reports.period}</th>
              <th scope="col" className="py-2 text-right font-normal">{m.reports.cols.rent}</th>
              <th scope="col" className="py-2 text-right font-normal">{m.reports.cols.utilities}</th>
              <th scope="col" className="py-2 text-right font-normal">{p.rate}</th>
            </tr>
          </thead>
          <tbody>
            {data.revenue.map((r) => (
              <tr key={r.period} className="border-b border-line">
                <td className="py-2 tabular-nums">{r.period}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(r.rentSatang, locale)}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(r.utilitiesSatang, locale)}</td>
                <td className="py-2 text-right tabular-nums">{pct(r.collectionRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={cn(ts('title', locale), 'text-ink')}>{p.usage}</h2>
        <table className="w-full border-collapse text-left text-ink">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th scope="col" className="py-2 font-normal">{m.property.buildings.title}</th>
              <th scope="col" className="py-2 text-right font-normal">{p.electricityUnits}</th>
              <th scope="col" className="py-2 text-right font-normal">{p.waterUnits}</th>
            </tr>
          </thead>
          <tbody>
            {data.usage.map((u) => (
              <tr key={u.buildingName} className="border-b border-line">
                <td className="py-2">{u.buildingName}</td>
                <td className="py-2 text-right tabular-nums">{u.electricityUnits}</td>
                <td className="py-2 text-right tabular-nums">{u.waterUnits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={cn(ts('title', locale), 'text-ink')}>{p.vacancy}</h2>
        {data.vacancy.length === 0 ? (
          <p className="text-ink-muted">{p.noVacancy}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.vacancy.map((v) => (
              <li key={v.roomNumber} className="flex justify-between gap-4 text-ink">
                <span className="tabular-nums">{v.roomNumber}</span>
                <span className="tabular-nums text-ink-muted">
                  {v.days === null ? p.never : `${v.days} ${p.days}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4 md:p-5">
        <h2 className={cn(ts('title', locale), 'text-ink')}>{p.todo.title}</h2>
        <ul className="flex flex-col gap-2">
          {todo.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={cn('flex min-h-[44px] items-center justify-between gap-4 text-ink underline-offset-4 hover:underline', focusRing)}>
                <span>{item.label}</span>
                <span className="tabular-nums">{item.count}</span>
              </Link>
            </li>
          ))}
        </ul>
        {todo.every((t) => t.count === 0) ? <p className="text-ink-muted">{p.todo.none}</p> : null}
      </section>
    </div>
  );
}

/** Month switcher, export and print for one report. */
export function ReportFrame({
  locale,
  report,
  period,
  title,
  intro,
  children,
}: {
  locale: Locale;
  report: 'rent-roll' | 'utilities' | 'deposits';
  period: string | null;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  const { m } = translator(locale);
  const r = m.reports;
  const base = `/${locale}/owner/reports/${report}`;
  const prev = period ? shiftMonth(period, -1) : null;
  const next = period ? shiftMonth(period, 1) : null;
  const chip = 'inline-flex min-h-[44px] items-center rounded-sm border border-line bg-surface-raised px-4 text-ink';
  return (
    <div className="flex flex-col gap-6" lang={locale}>
      <p className={cn(ts('body', locale), 'text-ink-muted')}>{intro}</p>
      <nav className="flex flex-wrap items-center gap-2 print:hidden" aria-label={r.period}>
        {period ? (
          <>
            <Link href={`${base}?p=${prev}`} className={cn(chip, focusRing)}>{r.prev}</Link>
            <span className="tabular-nums text-ink">{period}</span>
            <Link href={`${base}?p=${next}`} className={cn(chip, focusRing)}>{r.next}</Link>
            <a href={`/${locale}/api/export/${report}?period=${period}`} className={cn(chip, focusRing)}>{r.exportCsv}</a>
          </>
        ) : null}
        <PrintButton label={r.print} />
      </nav>
      <h2 className="sr-only">{title}</h2>
      {children}
    </div>
  );
}

function shiftMonth(period: string, delta: number): string {
  const [y, mo] = period.split('-').map(Number);
  const index = y! * 12 + (mo! - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function RentRollTable({ locale, rows }: { locale: Locale; rows: RentRollRow[] }) {
  const { m } = translator(locale);
  const c = m.reports.cols;
  const sum = (pick: (r: RentRollRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  return (
    <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring" tabIndex={0}>
      <table className="w-full min-w-[40rem] border-collapse text-left text-ink">
        <thead>
          <tr className="border-b border-line text-ink-muted">
            <th scope="col" className="py-2 font-normal">{c.room}</th>
            <th scope="col" className="py-2 font-normal">{c.tenant}</th>
            <th scope="col" className="py-2 font-normal">{c.status}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.rent}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.utilities}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.billed}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.paid}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.outstanding}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.roomNumber} className="border-b border-line">
              <td className="py-2 tabular-nums">{r.roomNumber}</td>
              <td className="py-2">{r.renterName ?? '—'}</td>
              <td className="py-2">{m.property.status[r.status]}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(r.rentSatang, locale)}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(r.utilitiesSatang, locale)}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(r.billedSatang, locale)}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(r.paidSatang, locale)}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(r.outstandingSatang, locale)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2" colSpan={3}>{m.reports.total}</td>
            <td className="py-2 text-right tabular-nums">{formatMoney(sum((r) => r.rentSatang), locale)}</td>
            <td className="py-2 text-right tabular-nums">{formatMoney(sum((r) => r.utilitiesSatang), locale)}</td>
            <td className="py-2 text-right tabular-nums">{formatMoney(sum((r) => r.billedSatang), locale)}</td>
            <td className="py-2 text-right tabular-nums">{formatMoney(sum((r) => r.paidSatang), locale)}</td>
            <td className="py-2 text-right tabular-nums">{formatMoney(sum((r) => r.outstandingSatang), locale)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function UtilitiesTable({ locale, rows }: { locale: Locale; rows: UtilityRow[] }) {
  const { m } = translator(locale);
  const c = m.reports.cols;
  return (
    <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring" tabIndex={0}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-ink">
        <thead>
          <tr className="border-b border-line text-ink-muted">
            <th scope="col" className="py-2 font-normal">{c.room}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.electricityUnits}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.electricity}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.waterUnits}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.water}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.roomNumber} className="border-b border-line">
              <td className="py-2 tabular-nums">{r.roomNumber}</td>
              <td className="py-2 text-right tabular-nums">{r.electricityUnits}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(r.electricitySatang, locale)}</td>
              <td className="py-2 text-right tabular-nums">{r.waterUnits}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(r.waterSatang, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DepositsTable({ locale, rows }: { locale: Locale; rows: DepositRow[] }) {
  const { m } = translator(locale);
  const c = m.reports.cols;
  return (
    <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring" tabIndex={0}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-ink">
        <thead>
          <tr className="border-b border-line text-ink-muted">
            <th scope="col" className="py-2 font-normal">{c.room}</th>
            <th scope="col" className="py-2 font-normal">{c.tenant}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.deposit}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.received}</th>
            <th scope="col" className="py-2 pl-6 font-normal">{c.settled}</th>
            <th scope="col" className="py-2 text-right font-normal">{c.refund}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.roomNumber} className="border-b border-line">
              <td className="py-2 tabular-nums">{r.roomNumber}</td>
              <td className="py-2">{r.renterName ?? '—'}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(r.depositSatang, locale)}</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(r.receivedSatang, locale)}</td>
              <td className="py-2 pl-6">{r.settled ? m.reports.yes : m.reports.no}</td>
              <td className="py-2 text-right tabular-nums">{r.refundSatang === null ? '—' : formatMoney(r.refundSatang, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
