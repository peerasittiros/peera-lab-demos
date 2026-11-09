'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { useStore } from '@/src/client-store/hooks';
import { roomMap } from '@/src/client-store/selectors/property';
import { dashboard } from '@/src/client-store/selectors/reports';
import type { StoreState } from '@/src/client-store/store';
import { translator, formatPeriod } from '@/src/i18n';
import { PageHeader } from '@/src/components/PageHeader';
import { FloorPlan } from '@/src/components/property/FloorPlan';
import { RoomPanel } from '@/src/components/property/RoomPanel';
import { Dot, KV } from './KV';
import { ReadyGate } from './ReadyGate';

const RING_RADIUS = 26;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const percentOf = (part: number, whole: number) =>
  whole > 0 ? part / whole : 0;

const buildingsView = (s: StoreState) => s.data.building;

/** The owner's overview (ux-v2/rentroll.md V3): this month's money, the building as a floor plan, and what needs you. */
export function DashboardLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <DashboardBody locale={locale} />
    </ReadyGate>
  );
}

const card =
  'flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-5';
const quietLink = (locale: Locale) =>
  cn(
    ts('ui', locale),
    'inline-flex min-h-11 items-center self-start text-product-accent underline underline-offset-4',
    focusRing,
  );

function DashboardBody({ locale }: { locale: Locale }) {
  const { m, t, tp } = translator(locale);
  const p = m.dashboard;
  const select = useCallback(
    (s: StoreState) =>
      s.snapshotDate
        ? dashboard(s.data, s.snapshotDate.slice(0, 7), s.snapshotDate)
        : null,
    [],
  );
  const data = useStore(select);
  const buildings = useStore(buildingsView);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];
  const selectRooms = useCallback(
    (s: StoreState) =>
      building && s.snapshotDate
        ? roomMap(s.data, building.id, s.snapshotDate)
        : [],
    [building],
  );
  const rooms = useStore(selectRooms);
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  if (!data) return null;

  const k = data.kpis;
  const billingDone = k.billedCount >= k.occupied;
  const collectedPercent = Math.round(
    percentOf(k.collectedSatang, k.billedSatang) * 100,
  );
  const occupancy = k.occupancy ?? 0;
  const occupancyText =
    k.occupancy === null
      ? m.contracts.blank
      : `${Math.round(occupancy * 100)}%`;
  const maxBilled = Math.max(1, ...data.revenue.map((r) => r.billedSatang));
  const currentPeriod = data.period;
  const todo = [
    {
      label: p.todo.slips,
      count: data.todo.slipsWaiting,
      href: '/owner/payments/review',
    },
    {
      label: p.todo.meters,
      count: data.todo.metersMissing,
      href: '/owner/meters/current',
    },
    {
      label: p.todo.overdue,
      count: data.todo.overdueCount,
      href: '/owner/overdue',
    },
    {
      label: p.todo.repairs,
      count: data.todo.openRepairs,
      href: '/owner/repairs',
    },
    {
      label: p.todo.notices,
      count: data.todo.noticesOpen,
      href: '/owner/contracts',
    },
  ].filter((item) => item.count > 0);
  const chip = (active: boolean) =>
    cn(
      ts('ui', locale),
      'inline-flex min-h-11 items-center rounded-sm border px-3 text-ink',
      active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
      focusRing,
    );

  return (
    <>
      <PageHeader locale={locale} title={p.title} description={p.intro} />

      {/* This month's money: billed (with how far billing got), paid, and what is past due. */}
      <div className="grid gap-3 md:grid-cols-3">
        <section aria-labelledby="billed-heading" className={card}>
          <h2
            id="billed-heading"
            className={cn(ts('label', locale), 'm-0 text-ink-muted')}
          >
            {p.billed}
          </h2>
          <p className="money-lg m-0 text-ink">
            {formatMoney(k.billedSatang, locale)}
          </p>
          <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
            {k.billedCount === 0
              ? p.noBillsYet
              : t('dashboard.billedOf', {
                  done: k.billedCount,
                  total: k.occupied,
                })}
          </p>
          {billingDone ? null : (
            <Link
              prefetch={false}
              href={`/${locale}/owner/billing/current`}
              className={quietLink(locale)}
            >
              {p.runBilling}
            </Link>
          )}
        </section>

        <section aria-labelledby="collected-heading" className={card}>
          <h2
            id="collected-heading"
            className={cn(ts('label', locale), 'm-0 text-ink-muted')}
          >
            {p.collected}
          </h2>
          <p className="money-lg m-0 text-ink">
            {k.billedSatang === 0
              ? m.contracts.blank
              : formatMoney(k.collectedSatang, locale)}
          </p>
          {k.billedSatang === 0 ? null : (
            <div
              role="progressbar"
              aria-label={p.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={collectedPercent}
              className="h-2 overflow-hidden rounded-xs bg-surface-sunken"
            >
              <div
                className="h-full bg-product-accent"
                style={{ width: `${collectedPercent}%` }}
              />
            </div>
          )}
          <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
            {k.billedSatang === 0
              ? p.noBillsYet
              : k.collectedSatang === 0
                ? p.noPaymentsYet
                : t('dashboard.paidShare', { percent: collectedPercent })}
          </p>
        </section>

        <section
          aria-labelledby="overdue-heading"
          className={cn(card, k.overdueCount > 0 && 'border-danger')}
        >
          <h2
            id="overdue-heading"
            className={cn(ts('label', locale), 'm-0 text-ink-muted')}
          >
            {p.overdueAmount}
          </h2>
          <p
            className={cn(
              'money-lg m-0',
              k.overdueSatang > 0 ? 'text-danger-ink' : 'text-ink',
            )}
          >
            {formatMoney(k.overdueSatang, locale)}
          </p>
          <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
            {tp('dashboard.overdueBills', k.overdueCount)}
            <Dot />
            <KV label={p.outstanding}>
              {formatMoney(k.outstandingSatang, locale)}
            </KV>
          </p>
          {k.overdueCount > 0 ? (
            <Link
              prefetch={false}
              href={`/${locale}/owner/overdue`}
              className={quietLink(locale)}
            >
              {p.seeOverdue}
            </Link>
          ) : null}
        </section>
      </div>

      {/* The building as a floor plan beside what needs the owner. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="rooms-heading" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="rooms-heading"
              className={cn(ts('title', locale), 'm-0 text-ink')}
            >
              {p.rooms}
            </h2>
            {buildings.length > 1 ? (
              <div
                role="group"
                aria-label={m.property.rooms.building}
                className="flex flex-wrap gap-2"
              >
                {buildings.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={b.id === building?.id}
                    onClick={() => setBuildingId(b.id)}
                    className={chip(b.id === building?.id)}
                  >
                    {locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <FloorPlan
            locale={locale}
            rooms={rooms}
            pickFloor
            floorHeading="h3"
            hrefOf={(room) => `/${locale}/owner/rooms/${room.roomId}`}
            onOpen={(room) => {
              opener.current = document.activeElement as HTMLElement | null;
              setOpenRoom(room.roomId);
            }}
          />
        </section>

        <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
          <section aria-labelledby="needs-heading" className={card}>
            <h2
              id="needs-heading"
              className={cn(ts('title', locale), 'm-0 text-ink')}
            >
              {p.needsYou}
            </h2>
            {todo.length === 0 ? (
              <p className="m-0 text-ink-muted">{p.allDone}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {todo.map((item) => (
                  <li
                    key={item.href}
                    className="border-b border-line last:border-b-0"
                  >
                    <Link
                      prefetch={false}
                      href={`/${locale}${item.href}`}
                      className={cn(
                        'flex min-h-11 items-center justify-between gap-3 py-2 text-ink hover:text-product-accent',
                        focusRing,
                      )}
                    >
                      <span>{item.label}</span>
                      <span className="min-w-8 rounded-xs bg-product-accent-soft px-2 text-center tabular-nums text-ink">
                        {item.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="occupancy-heading"
            className={cn(card, 'flex-row items-center gap-4')}
          >
            <svg
              viewBox="0 0 64 64"
              aria-hidden
              className="size-16 shrink-0 -rotate-90"
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
                className="stroke-product-accent"
                strokeDasharray={`${RING_LENGTH * occupancy} ${RING_LENGTH}`}
              />
            </svg>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2
                id="occupancy-heading"
                className={cn(ts('label', locale), 'm-0 text-ink-muted')}
              >
                {p.occupancy}
              </h2>
              <p
                className={cn(
                  ts('headline-sm', locale),
                  'm-0 tabular-nums text-ink',
                )}
              >
                {occupancyText}
              </p>
              <p className="m-0 tabular-nums text-ink-muted">{`${k.occupied} / ${k.rentable}`}</p>
            </div>
          </section>
        </div>
      </div>

      <section
        aria-labelledby="revenue-heading"
        className={cn(card, 'mt-6 gap-4')}
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
              {/* This month is still being billed: an outline, not a short bar that reads as a bad month. */}
              <span
                className={cn(
                  'block w-full rounded-xs',
                  r.period === currentPeriod
                    ? 'border border-dashed border-line-strong'
                    : 'bg-product-accent',
                )}
                style={{
                  height:
                    r.period === currentPeriod
                      ? '100%'
                      : `${(r.billedSatang / maxBilled) * 100}%`,
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
                <span className="tabular-nums text-ink-muted">{formatPeriod(r.period, locale)}</span>
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
                {r.period === currentPeriod
                  ? p.thisMonth
                  : `${p.rate} ${
                      r.collectionRate === null
                        ? m.contracts.blank
                        : `${Math.round(r.collectionRate * 100)}%`
                    }`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className={card}>
          <h2 className={cn(ts('title', locale), 'm-0 text-ink')}>{p.usage}</h2>
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
        <section className={card}>
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

      <RoomPanel
        locale={locale}
        roomId={openRoom}
        onClose={() => setOpenRoom(null)}
        returnFocus={opener.current}
      />
    </>
  );
}
