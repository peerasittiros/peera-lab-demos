'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import Link from 'next/link';
import { useCallback } from 'react';
import { useStore } from '@/src/client-store/hooks';
import { dashboard } from '@/src/client-store/selectors/reports';
import type { StoreState } from '@/src/client-store/store';
import { translator } from '@/src/i18n';
import { PageHeader } from '@/src/components/PageHeader';
import { Dot, KV } from './KV';
import { ReadyGate } from './ReadyGate';

const RING_RADIUS = 26;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const percentOf = (part: number, whole: number) =>
  whole > 0 ? part / whole : 0;

/** The owner's dashboard (SPEC §4 O1): this month's money and occupancy, twelve months of revenue, and the to-do list. */
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
  const collected = percentOf(k.collectedSatang, k.billedSatang);
  const occupancy = k.occupancy ?? 0;
  const occupancyText =
    k.occupancy === null
      ? m.contracts.blank
      : `${Math.round(occupancy * 100)}%`;
  const occupancyLabel = `${p.occupancy} ${occupancyText}`;
  const occupiedOf = `${k.occupied} / ${k.rentable}`;
  const collectedPercent = Math.round(collected * 100);
  const maxBilled = Math.max(1, ...data.revenue.map((r) => r.billedSatang));
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
  const tiles = [
    {
      label: p.overdue,
      value: String(k.overdueCount),
      alert: k.overdueCount > 0,
    },
    {
      label: p.overdueAmount,
      value: formatMoney(k.overdueSatang, locale),
      alert: k.overdueSatang > 0,
    },
    { label: p.openRepairs, value: String(k.openRepairs), alert: false },
    { label: p.moveOuts, value: String(k.moveOuts30), alert: false },
  ];

  return (
    <>
      <PageHeader locale={locale} title={p.title} description={p.intro} />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="collected-heading"
          className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-5"
        >
          <h2
            id="collected-heading"
            className={cn(ts('label', locale), 'm-0 text-ink-muted')}
          >
            {p.collected}
          </h2>
          <p
            className={cn(
              ts('headline-lg', locale),
              'm-0 tabular-nums text-ink',
            )}
          >
            {formatMoney(k.collectedSatang, locale)}
          </p>
          <div
            role="progressbar"
            aria-label={p.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={collectedPercent}
            className="h-2 overflow-hidden rounded-full bg-surface-sunken"
          >
            <div
              className="h-full rounded-full bg-product-accent"
              style={{ width: `${collectedPercent}%` }}
            />
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <dt className="text-ink-muted">{p.billed}</dt>
              <dd className="m-0 tabular-nums text-ink">
                {formatMoney(k.billedSatang, locale)}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-ink-muted">{p.outstanding}</dt>
              <dd className="m-0 tabular-nums text-ink">
                {formatMoney(k.outstandingSatang, locale)}
              </dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="occupancy-heading"
          className="flex items-center gap-5 rounded-sm border border-line bg-surface-raised p-5"
        >
          <svg
            viewBox="0 0 64 64"
            role="img"
            aria-label={occupancyLabel}
            className="size-20 shrink-0 -rotate-90"
          >
            <circle
              cx="32"
              cy="32"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              className="stroke-surface-sunken"
            />
            <circle
              cx="32"
              cy="32"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className="stroke-product-accent"
              strokeDasharray={`${RING_LENGTH * occupancy} ${RING_LENGTH}`}
            />
          </svg>
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id="occupancy-heading"
              className={cn(ts('label', locale), 'm-0 text-ink-muted')}
            >
              {p.occupancy}
            </h2>
            <p
              className={cn(
                ts('headline-md', locale),
                'm-0 tabular-nums text-ink',
              )}
            >
              {occupancyText}
            </p>
            <p className="m-0 tabular-nums text-ink-muted">{occupiedOf}</p>
          </div>
        </section>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={cn(
              'flex flex-col gap-1 rounded-sm border p-4',
              t.alert
                ? 'border-danger bg-danger-soft'
                : 'border-line bg-surface-raised',
            )}
          >
            <dt className={t.alert ? 'text-ink' : 'text-ink-muted'}>
              {t.label}
            </dt>
            <dd
              className={cn(
                ts('headline-sm', locale),
                'm-0 tabular-nums',
                t.alert ? 'text-danger-ink' : 'text-ink',
              )}
            >
              {t.value}
            </dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="revenue-heading"
        className="mt-4 flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-5"
      >
        <h2
          id="revenue-heading"
          className={cn(ts('title', locale), 'm-0 text-ink')}
        >
          {p.revenue}
        </h2>
        <div
          aria-hidden
          className="grid h-40 grid-cols-12 items-end gap-1 md:gap-2"
        >
          {data.revenue.map((r) => (
            <div key={r.period} className="flex h-full flex-col justify-end">
              <span
                className="block w-full rounded-xs bg-product-accent"
                style={{
                  height: `${(r.billedSatang / maxBilled) * 100}%`,
                  minHeight: r.billedSatang ? '2px' : '0',
                }}
              />
            </div>
          ))}
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {data.revenue.map((r) => (
            <li
              key={r.period}
              className="flex flex-col gap-0.5 border-b border-line py-2 last:border-b-0 md:flex-row md:items-baseline md:justify-between md:gap-4"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="tabular-nums text-ink-muted">{r.period}</span>
                <span className="tabular-nums text-ink">
                  {formatMoney(r.billedSatang, locale)}
                </span>
              </div>
              <span
                className={cn(
                  ts('body-sm', locale),
                  'tabular-nums text-ink-muted',
                )}
              >
                {p.rate}{' '}
                {r.collectionRate === null
                  ? m.contracts.blank
                  : `${Math.round(r.collectionRate * 100)}%`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-5">
          <h2 className={cn(ts('title', locale), 'm-0 text-ink')}>
            {p.todo.title}
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {todo.map((t) => (
              <li key={t.href} className="border-b border-line last:border-b-0">
                <Link
                  href={t.href}
                  className={cn(
                    'flex min-h-11 items-center justify-between gap-3 py-2 text-ink hover:text-product-accent',
                    focusRing,
                  )}
                >
                  <span>{t.label}</span>
                  <span
                    className={cn(
                      'min-w-8 rounded-xs px-2 text-center tabular-nums',
                      t.count > 0
                        ? 'bg-product-accent-soft text-ink'
                        : 'text-ink-muted',
                    )}
                  >
                    {t.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-5">
            <h2 className={cn(ts('title', locale), 'm-0 text-ink')}>
              {p.usage}
            </h2>
            {data.usage.map((u) => (
              <KV key={u.buildingName} label={u.buildingName}>
                <span className="tabular-nums">
                  {u.electricityUnits}
                  <Dot />
                  {u.waterUnits}
                </span>
              </KV>
            ))}
          </section>
          <section className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-5">
            <h2 className={cn(ts('title', locale), 'm-0 text-ink')}>
              {p.vacancy}
            </h2>
            {data.vacancy.length === 0 ? (
              <p className="m-0 text-ink-muted">{p.noVacancy}</p>
            ) : null}
            {data.vacancy.map((v) => (
              <KV key={v.roomNumber} label={v.roomNumber}>
                <span className="tabular-nums">
                  {v.days === null ? p.never : `${v.days} ${p.days}`}
                </span>
              </KV>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
