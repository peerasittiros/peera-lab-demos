import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import { Megaphone, Receipt, Wrench, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { formatDay, formatPeriod, translator } from '../../i18n';

/** What the tenant home shows. The server query and the store selector both return this shape. */
export type HomeView = {
  roomNumber: string;
  floor: number | null;
  floorRooms: string[];
  balanceSatang: number;
  nextInvoice: { id: string; dueDate: string } | null;
  announcements: {
    id: string;
    titleTh: string;
    titleEn: string;
    bodyTh: string;
    bodyEn: string;
  }[];
};

/**
 * The tenant's home (ux-v2/rentroll.md › Tenant view): the amount due card with the floor strip (their room among the
 * rooms on their floor), the due date and Pay, then tiles for bills, repairs and notices, and the latest notices.
 */
export function TenantHome({
  locale,
  home,
}: {
  locale: Locale;
  home: HomeView | null;
}) {
  const { m, t } = translator(locale);
  const p = m.tenant.home;
  if (!home) return <p className="text-ink-muted">{m.tenant.home.none}</p>;
  const base = `/${locale}`;
  const tile = (href: string, label: string, Icon: LucideIcon) => (
    <Link
      href={`${base}${href}`}
      className={cn(
        ts('ui', locale),
        'flex min-h-20 flex-col items-center justify-center gap-2 rounded-sm border border-line bg-surface-raised px-2 py-3 text-center text-ink hover:bg-surface-sunken',
        focusRing,
      )}
    >
      <Icon
        aria-hidden
        size={22}
        strokeWidth={1.75}
        className="text-product-accent"
      />
      {label}
    </Link>
  );
  return (
    <div className="flex flex-col gap-4" lang={locale}>
      <section className="flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-ink">
            {home.floor === null
              ? `${p.room} ${home.roomNumber}`
              : t('tenant.home.roomOnFloor', {
                  room: home.roomNumber,
                  floor: home.floor,
                })}
          </p>
          {home.floor !== null && home.floorRooms.length > 1 ? (
            // The floor strip (the v2 motif): one cell per room on the floor, the tenant's filled. Decorative: the
            // sentence beside it says the same.
            <span
              aria-hidden
              className="flex gap-0.5"
              title={t('tenant.home.floorStrip', { floor: home.floor })}
            >
              {home.floorRooms.map((number) => (
                <span
                  key={number}
                  className={cn(
                    'h-3 w-2 rounded-[2px] border',
                    number === home.roomNumber
                      ? 'border-product-accent bg-product-accent'
                      : 'border-line-strong bg-transparent',
                  )}
                />
              ))}
            </span>
          ) : null}
        </div>
        <p className="m-0 text-ink-muted">{p.balance}</p>
        <p className="money-lg m-0 text-ink">
          {formatMoney(home.balanceSatang, locale)}
        </p>
        {home.nextInvoice ? (
          <>
            <p className="m-0 text-ink-muted">
              <span>{p.due}</span>{' '}
              <span className="tabular-nums text-ink">
                {formatDay(home.nextInvoice.dueDate, locale)}
              </span>
            </p>
            <Link
              href={`${base}/t/pay/${home.nextInvoice.id}`}
              className={cn(
                ts('ui', locale),
                'inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-product-accent px-4 font-semibold text-product-on-accent hover:bg-primary-hover',
                focusRing,
              )}
            >
              {p.payNow}
            </Link>
          </>
        ) : (
          <p className="text-ink">{p.allPaid}</p>
        )}
      </section>

      <nav className="grid grid-cols-3 gap-2" aria-label={p.tiles.bills}>
        {tile('/t/bills', p.tiles.bills, Receipt)}
        {tile('/t/repairs/new', p.tiles.repairs, Wrench)}
        {tile('/t#announcements', p.tiles.news, Megaphone)}
      </nav>

      <section
        id="announcements"
        className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4 md:p-5"
      >
        <h2 className={cn(ts('title', locale), 'text-ink')}>
          {p.announcements}
        </h2>
        {home.announcements.length === 0 ? (
          <p className="text-ink-muted">{p.noAnnouncements}</p>
        ) : (
          home.announcements.slice(0, 3).map((a) => (
            <article key={a.id} className="flex flex-col gap-1">
              <h3 className="font-semibold text-ink">
                {locale === 'th' ? a.titleTh : a.titleEn}
              </h3>
              <p className="text-ink">
                {locale === 'th' ? a.bodyTh : a.bodyEn}
              </p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

type Bill = {
  id: string;
  number: string;
  type: string;
  period: string | null;
  dueDate: string;
  status: string;
  totalSatang: number;
  paidSatang: number;
};

/** Twelve months of bills, and usage bars per month (01 §3.1 D.14). */
export function BillsView({
  locale,
  bills,
  usage,
}: {
  locale: Locale;
  bills: Bill[];
  usage: { period: string; electricity: number | null; water: number | null }[];
}) {
  const { m } = translator(locale);
  const p = m.tenant.bills;
  const top = Math.max(
    1,
    ...usage.map((u) => Math.max(u.electricity ?? 0, u.water ?? 0)),
  );
  return (
    <div className="flex flex-col gap-8" lang={locale}>
      <section className="flex flex-col gap-3">
        <h2 className={cn(ts('title', locale), 'text-ink')}>{p.usage}</h2>
        {usage.length === 0 ? (
          <p className="text-ink-muted">{p.noUsage}</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label={p.usage}>
            {usage.map((u) => (
              <li
                key={u.period}
                className="grid grid-cols-[6rem_1fr] items-center gap-3"
              >
                <span className="tabular-nums text-ink-muted">
                  {formatPeriod(u.period, locale)}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-ink">
                    <span
                      className="h-3 rounded-sm bg-ink"
                      style={{
                        width: `${((u.electricity ?? 0) / top) * 100}%`,
                        minWidth: u.electricity ? '2px' : '0',
                      }}
                    />
                    <span className="tabular-nums">
                      {u.electricity ?? p.blank}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-ink">
                    <span
                      className="h-3 rounded-sm bg-ink-muted"
                      style={{
                        width: `${((u.water ?? 0) / top) * 100}%`,
                        minWidth: u.water ? '2px' : '0',
                      }}
                    />
                    <span className="tabular-nums">{u.water ?? p.blank}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-ink-muted">{p.unitsNote}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={cn(ts('title', locale), 'text-ink')}>{p.title}</h2>
        {bills.length === 0 ? (
          <p className="text-ink-muted">{p.noBills}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {bills.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/${locale}/t/bills/${b.id}`}
                  className={cn(
                    'grid min-h-[44px] gap-x-4 gap-y-1 rounded-sm border border-line bg-surface-raised p-4 text-ink hover:bg-surface-sunken md:grid-cols-4',
                    focusRing,
                  )}
                >
                  <span className="tabular-nums">{b.number}</span>
                  <span className="tabular-nums text-ink-muted">
                    {b.period
                      ? formatPeriod(b.period, locale)
                      : formatDay(b.dueDate, locale)}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(b.totalSatang, locale)}
                  </span>
                  <span className="text-ink-muted">
                    {p.status[b.status as keyof typeof p.status] ?? b.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** The owner's side of the split: waiting slips, open repairs, and the newest events from the tenant side. */
export function OwnerFeed({
  locale,
  slipsWaiting,
  openRepairs,
  events,
}: {
  locale: Locale;
  slipsWaiting: number;
  openRepairs: number;
  events: {
    id: number;
    kind: string;
    at: string;
    payload: Record<string, unknown>;
  }[];
}) {
  const { m } = translator(locale);
  const p = m.tenant.feed;
  const label = (kind: string) => p.kinds[kind as keyof typeof p.kinds] ?? kind;
  return (
    <div className="flex flex-col gap-4" lang={locale}>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-sm border border-line bg-surface-raised p-4">
          <dt className="text-ink-muted">{p.slipsWaiting}</dt>
          <dd className="tabular-nums text-ink">{slipsWaiting}</dd>
        </div>
        <div className="rounded-sm border border-line bg-surface-raised p-4">
          <dt className="text-ink-muted">{p.openRepairs}</dt>
          <dd className="tabular-nums text-ink">{openRepairs}</dd>
        </div>
      </dl>
      <section className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4">
        <h2 className={cn(ts('title', locale), 'text-ink')}>{p.title}</h2>
        {events.length === 0 ? (
          <p className="text-ink-muted">{p.empty}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap justify-between gap-2 text-ink"
              >
                <span>{label(e.kind)}</span>
                <span className="tabular-nums text-ink-muted">
                  {new Date(e.at).toLocaleTimeString(
                    locale === 'th' ? 'th-TH' : 'en-GB',
                    { timeZone: 'Asia/Bangkok' },
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
