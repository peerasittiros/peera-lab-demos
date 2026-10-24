'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, toast } from '@peera/ui';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import { actSetMaintenance } from '@/src/client-store/commands/property';
import {
  buildingsWithRates,
  roomDetail,
  roomMap,
  roomTypeComparison,
} from '@/src/client-store/selectors/property';
import type { StoreState } from '@/src/client-store/store';
import { translator, type Messages } from '@/src/i18n';
import { PageHeader } from '@/src/components/PageHeader';
import { ReadyGate } from './ReadyGate';
import { Dot, KV } from './KV';

type Filter =
  | 'all'
  | 'vacant'
  | 'occupied'
  | 'reserved'
  | 'maintenance'
  | 'notice'
  | 'overdue';
const FILTERS: Filter[] = [
  'all',
  'vacant',
  'occupied',
  'reserved',
  'maintenance',
  'notice',
  'overdue',
];
const buildingsView = (s: StoreState) => s.data.building;

function useBuildingId(initial: string | undefined) {
  return useState<string | null>(initial ?? null);
}

/** The room map (SPEC §4 O2): filter chips by status, building switch, room cards; a card opens the room. */
export function RoomMapLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <RoomMapBody locale={locale} />
    </ReadyGate>
  );
}

function RoomMapBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.property.rooms;
  const buildings = useStore(buildingsView);
  const [buildingId, setBuildingId] = useBuildingId(undefined);
  const [filter, setFilter] = useState<Filter>('all');
  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];
  const select = useCallback(
    (s: StoreState) =>
      building && s.snapshotDate
        ? roomMap(s.data, building.id, s.snapshotDate)
        : [],
    [building],
  );
  const rooms = useStore(select);
  const shown = rooms.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'notice') return r.notice;
    if (filter === 'overdue') return r.daysPastDue > 0;
    return r.status === filter;
  });
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-11 items-center rounded-sm border px-3 text-ink',
      active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
      focusRing,
    );
  const filterLabel = (f: Filter) =>
    f === 'all'
      ? m.ownerLive.filterAll
      : f === 'notice'
        ? m.ownerLive.filterNotice
        : f === 'overdue'
          ? m.ownerLive.filterOverdue
          : m.property.status[f];

  return (
    <>
      <nav aria-label={p.building} className="mb-3 flex flex-wrap gap-2">
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
      </nav>
      <nav aria-label={p.legend} className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={chip(filter === f)}
          >
            {filterLabel(f)}
          </button>
        ))}
      </nav>
      {shown.length === 0 ? <p className="text-ink-muted">{p.empty}</p> : null}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {shown.map((r) => (
          <li key={r.roomId}>
            <Link
              href={`/${locale}/owner/rooms/${r.roomId}`}
              aria-label={`${p.open}: ${r.number}`}
              className={cn(
                'flex min-h-11 flex-col gap-2 rounded-sm border border-line bg-surface-raised p-3 hover:bg-surface-sunken',
                focusRing,
              )}
            >
              <span className="tabular-nums text-ink">{r.number}</span>
              <span className="text-ink-muted">
                {m.property.status[r.status]}
              </span>
              {r.renterName ? (
                <span className="truncate text-ink">
                  {r.renterName.split(' ')[0]}
                </span>
              ) : null}
              {r.rent !== null ? (
                <span className="tabular-nums text-ink">
                  {formatMoney(r.rent, locale)}
                </span>
              ) : null}
              {r.daysPastDue > 0 ? (
                <span className="tabular-nums text-danger">
                  <KV label={p.overdueDays}>{r.daysPastDue}</KV>
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** A room's detail (SPEC §4 O3): status, contract and renter, the maintenance flag, bills and meter history. */
export function RoomDetailLive({
  locale,
  roomId,
}: {
  locale: Locale;
  roomId: string;
}) {
  return (
    <ReadyGate locale={locale}>
      <RoomDetailBody locale={locale} roomId={roomId} />
    </ReadyGate>
  );
}

function RoomDetailBody({
  locale,
  roomId,
}: {
  locale: Locale;
  roomId: string;
}) {
  const { m } = translator(locale);
  const p = m.property.room;
  const select = useCallback(
    (s: StoreState) =>
      s.snapshotDate ? roomDetail(s.data, roomId, s.snapshotDate) : null,
    [roomId],
  );
  const detail = useStore(select);
  const role = useRole();
  if (!detail) return <p className="text-ink-muted">{p.notFound}</p>;
  const room = detail.room;
  const name = (value: string | null) => value ?? m.contracts.blank;

  return (
    <>
      <PageHeader
        locale={locale}
        title={`${p.title} ${room.number}`}
        description={detail.buildingName}
      />
      <Link
        href={`/${locale}/owner/rooms`}
        className={cn(
          'mb-4 inline-flex min-h-11 items-center text-ink underline-offset-4 hover:underline',
          focusRing,
        )}
      >
        {p.back}
      </Link>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4">
          <p className="text-ink">
            <KV label={p.status}>{m.property.status[detail.status]}</KV>
          </p>
          <p className="text-ink">
            <KV label={p.roomType}>{name(detail.typeName)}</KV>
          </p>
          {detail.contract ? (
            <>
              <p className="text-ink">
                <KV label={p.renter}>{name(detail.contract.renterName)}</KV>
              </p>
              <p className="tabular-nums text-ink-muted">
                <KV label={p.contractStart}>{detail.contract.startDate}</KV>
                <Dot />
                <KV label={p.contractEnd}>
                  {detail.contract.endDate ?? m.contracts.blank}
                </KV>
              </p>
              <Link
                href={`/${locale}/owner/contracts/${detail.contract.id}`}
                className={cn(
                  'inline-flex min-h-11 items-center text-ink underline-offset-4 hover:underline',
                  focusRing,
                )}
              >
                {p.contract}
              </Link>
            </>
          ) : (
            <p className="text-ink-muted">{p.noContract}</p>
          )}
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input
              type="checkbox"
              checked={room.maintenance}
              disabled={role !== 'owner'}
              onChange={(e) => {
                const result = actSetMaintenance(
                  { store: getStore(), role, now: () => new Date() },
                  { roomId: room.id, maintenance: e.target.checked },
                );
                toast({
                  title: result.ok
                    ? m.property.saved
                    : m.property.errors.saveFailed,
                });
              }}
              className="size-5"
            />
            <span>{p.maintenance}</span>
          </label>
          <p className="text-ink-muted">{p.maintenanceHint}</p>
        </section>
        <section className="flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4">
          <h2 className="text-ink">{m.ownerLive.lastBills}</h2>
          {detail.bills.length === 0 ? (
            <p className="text-ink-muted">{m.tenant.bills.noBills}</p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {detail.bills.map((b) => (
              <li key={b.id} className="flex justify-between gap-3 text-ink">
                <span className="tabular-nums">{b.number}</span>
                <span className="tabular-nums">
                  {formatMoney(b.totalSatang, locale)}
                </span>
              </li>
            ))}
          </ul>
          <h2 className="mt-4 text-ink">{m.ownerLive.meterHistory}</h2>
          <ul className="flex flex-col gap-1 tabular-nums text-ink-muted">
            {detail.electricity.slice(0, 6).map((r) => (
              <li key={`e-${r.period}`}>
                <KV label={`${m.meters.kind.electricity} ${r.period}`}>
                  {r.reading} {r.unitsUsed !== null ? `(${r.unitsUsed})` : ''}
                </KV>
              </li>
            ))}
            {detail.water.slice(0, 6).map((r) => (
              <li key={`w-${r.period}`}>
                <KV label={`${m.meters.kind.water} ${r.period}`}>
                  {r.reading} {r.unitsUsed !== null ? `(${r.unitsUsed})` : ''}
                </KV>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

/** Room types side by side (SPEC §4 O4): the move-in total and the free rooms, in one grid. */
export function RoomTypesLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <RoomTypesBody locale={locale} />
    </ReadyGate>
  );
}

function RoomTypesBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const buildings = useStore(buildingsView);
  const building = buildings[0];
  const select = useCallback(
    (s: StoreState) =>
      building && s.snapshotDate
        ? roomTypeComparison(s.data, building.id, s.snapshotDate)
        : [],
    [building],
  );
  const types = useStore(select);
  const p = m.property.roomTypes;
  if (types.length === 0) return <p className="text-ink-muted">{p.empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-ink-muted">
            <th scope="col" className="py-2 font-normal" />
            {types.map((t) => (
              <th key={t.id} scope="col" className="py-2 font-normal text-ink">
                {locale === 'th' ? t.nameTh : t.nameEn}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(
            [
              [
                p.monthlyRent,
                (t: (typeof types)[number]) =>
                  formatMoney(t.monthlyRentSatang, locale),
              ],
              [
                p.deposit,
                (t: (typeof types)[number]) =>
                  formatMoney(t.depositSatang, locale),
              ],
              [
                p.advanceMonths,
                (t: (typeof types)[number]) => String(t.advanceMonths),
              ],
              [
                m.ownerLive.sizeSqm,
                (t: (typeof types)[number]) =>
                  t.sizeSqm !== null ? String(t.sizeSqm) : m.contracts.blank,
              ],
              [
                m.ownerLive.moveInTotal,
                (t: (typeof types)[number]) =>
                  formatMoney(t.moveInTotalSatang, locale),
              ],
              [
                m.ownerLive.roomsFree,
                (t: (typeof types)[number]) =>
                  `${t.roomsFree} / ${t.roomsTotal}`,
              ],
            ] as [string, (t: (typeof types)[number]) => string][]
          ).map(([label, value]) => (
            <tr
              key={label}
              className="border-b border-line odd:bg-surface-sunken"
            >
              <th scope="row" className="py-2 pr-4 font-normal text-ink-muted">
                {label}
              </th>
              {types.map((t) => (
                <td key={t.id} className="py-2 tabular-nums text-ink">
                  {value(t)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Buildings and their rate plans, read-only in this demo (SPEC §4 O5). */
export function BuildingsRatesLive({
  locale,
  section,
}: {
  locale: Locale;
  section: 'buildings' | 'rates';
}) {
  return (
    <ReadyGate locale={locale}>
      <BuildingsRatesBody locale={locale} section={section} />
    </ReadyGate>
  );
}

function BuildingsRatesBody({
  locale,
  section,
}: {
  locale: Locale;
  section: 'buildings' | 'rates';
}) {
  const { m } = translator(locale);
  const p: Messages['property'] = m.property;
  const select = useCallback(
    (s: StoreState) => buildingsWithRates(s.data, s.snapshotDate ?? ''),
    [],
  );
  const rows = useStore(select);
  if (section === 'buildings') {
    return (
      <>
        <p className="mb-4 text-ink-muted">{m.ownerLive.buildingsRead}</p>
        <ul className="flex flex-col gap-3">
          {rows.map(({ building: b }) => (
            <li
              key={b.id}
              className="flex flex-col gap-1 rounded-sm border border-line bg-surface-raised p-4 text-ink"
            >
              <span>{locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh)}</span>
              <span className="text-ink-muted">
                {locale === 'th' ? b.addressTh : (b.addressEn ?? b.addressTh)}
              </span>
              <span className="tabular-nums">
                <KV label={p.buildings.promptpayId}>{b.promptpayId}</KV>
              </span>
              <span className="tabular-nums">
                <KV label={p.buildings.billingDay}>{b.billingDay}</KV>
                <Dot />
                <KV label={p.buildings.dueDay}>{b.dueDay}</KV>
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <>
      <p className="mb-4 text-ink-muted">{m.ownerLive.ratesRead}</p>
      {rows.map(({ building, plans, current }) => (
        <section key={building.id} className="mb-6 flex flex-col gap-3">
          <h2 className="text-ink">
            {locale === 'th'
              ? building.nameTh
              : (building.nameEn ?? building.nameTh)}
          </h2>
          {current ? (
            <p className="tabular-nums text-ink">
              <KV label={p.rates.current}>{current.validFrom}</KV>
              <Dot />
              <KV label={p.rates.electricityRate}>{current.elecRateSatang}</KV>
              <Dot />
              <KV label={p.rates.commonFee}>{current.commonFeeSatang}</KV>
            </p>
          ) : (
            <p className="text-ink-muted">{m.ownerLive.noPlan}</p>
          )}
          <ul className="flex flex-col gap-1">
            {plans.map((plan) => (
              <li key={plan.id} className="tabular-nums text-ink-muted">
                <KV label={p.rates.validFrom}>{plan.validFrom}</KV>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
