'use client';

import { formatDate, formatMoney, type Locale } from '@peera/i18n';
import {
  cn,
  focusRing,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  ts,
} from '@peera/ui';
import Link from 'next/link';
import { useCallback } from 'react';
import { useStore } from '@/src/client-store/hooks';
import { roomDetail } from '@/src/client-store/selectors/property';
import type { StoreState } from '@/src/client-store/store';
import { translator } from '@/src/i18n';

/**
 * A room opened from the floor plan without leaving the page (ux-v2/rentroll.md › Owner overview, desktop): status,
 * tenant and contract, the last bills, and links to the room and contract pages. Phones open the room page instead.
 */
export function RoomPanel({
  locale,
  roomId,
  onClose,
  returnFocus,
}: {
  locale: Locale;
  roomId: string | null;
  onClose: () => void;
  /** The tile that opened the panel; focus goes back to it on close (the panel has no trigger of its own). */
  returnFocus: HTMLElement | null;
}) {
  return (
    <Sheet open={roomId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        locale={locale}
        onCloseAutoFocus={(event) => {
          if (!returnFocus) return;
          event.preventDefault();
          returnFocus.focus();
        }}
      >
        {roomId ? <RoomPanelBody locale={locale} roomId={roomId} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function RoomPanelBody({ locale, roomId }: { locale: Locale; roomId: string }) {
  const { m } = translator(locale);
  const p = m.property.room;
  const select = useCallback(
    (s: StoreState) =>
      s.snapshotDate ? roomDetail(s.data, roomId, s.snapshotDate) : null,
    [roomId],
  );
  const detail = useStore(select);
  if (!detail) return null;
  const building =
    locale === 'th' ? detail.buildingNameTh : detail.buildingName;
  const link = cn(
    ts('ui', locale),
    'inline-flex min-h-11 items-center rounded-sm border border-line-strong px-4 text-ink hover:bg-surface-sunken',
    focusRing,
  );

  return (
    <div className="flex flex-col gap-5 pr-8">
      <div>
        <SheetTitle locale={locale}>
          <span className="font-mono text-[22px] leading-7 font-semibold tabular-nums">
            {detail.room.number}
          </span>
        </SheetTitle>
        <SheetDescription locale={locale}>
          {`${building} · ${m.property.status[detail.status]}`}
        </SheetDescription>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-ink-muted">{p.renter}</dt>
        <dd className="m-0 text-ink">
          {detail.contract?.renterName ?? p.noContract}
        </dd>
        {detail.contract ? (
          <>
            <dt className="text-ink-muted">{p.contractStart}</dt>
            <dd className="m-0 tabular-nums text-ink">
              {formatDate(detail.contract.startDate, locale)}
            </dd>
            <dt className="text-ink-muted">{p.contractEnd}</dt>
            <dd className="m-0 tabular-nums text-ink">
              {detail.contract.endDate
                ? formatDate(detail.contract.endDate, locale)
                : m.contracts.blank}
            </dd>
          </>
        ) : null}
      </dl>

      <section aria-labelledby="panel-bills" className="flex flex-col gap-2">
        <h3
          id="panel-bills"
          className={cn(ts('label', locale), 'm-0 text-ink')}
        >
          {m.ownerLive.lastBills}
        </h3>
        {detail.bills.length === 0 ? (
          <p className="m-0 text-ink-muted">{m.tenant.bills.noBills}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {detail.bills.map((bill) => (
              <li
                key={bill.id}
                className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0"
              >
                <span className="grid">
                  <span className="tabular-nums text-ink">{bill.number}</span>
                  <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                    {m.billing.status[
                      bill.status as keyof typeof m.billing.status
                    ] ?? bill.status}
                  </span>
                </span>
                <span className="money text-ink">
                  {formatMoney(bill.totalSatang, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          prefetch={false}
          href={`/${locale}/owner/rooms/${detail.room.id}`}
          className={link}
        >
          {m.dashboard.openRoom}
        </Link>
        {detail.contract ? (
          <Link
            prefetch={false}
            href={`/${locale}/owner/contracts/${detail.contract.id}`}
            className={link}
          >
            {m.dashboard.openContract}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
