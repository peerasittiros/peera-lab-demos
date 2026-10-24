'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, toast } from '@peera/ui';
import { useCallback, useState } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import { actVoidDraft } from '@/src/client-store/commands/billing';
import {
  invoiceList,
  visitorInvoiceIds,
} from '@/src/client-store/selectors/billing';
import type { StoreState } from '@/src/client-store/store';
import { translator, type Messages } from '@/src/i18n';
import { ReadyGate } from './ReadyGate';
import { CreditNoteForm } from './OwnerEdits';
import { publicLinkFor } from './public-link';

const listView = (s: StoreState) => invoiceList(s.data);
const visitorsView = (s: StoreState) => visitorInvoiceIds(s.ops);
const STATUSES = [
  'all',
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'void',
] as const;

/**
 * The invoices list (SPEC §4 O11): filter by status and month, search by room, open the public link or copy it, and void
 * a draft (owner only). Sent invoices are never changed here.
 */
export function InvoicesLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <InvoicesBody locale={locale} />
    </ReadyGate>
  );
}

function InvoicesBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.billing;
  const list = useStore(listView);
  const visitors = useStore(visitorsView);
  const role = useRole();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [month, setMonth] = useState<string>('all');
  const [room, setRoom] = useState('');

  const months = [
    ...new Set(
      list.map((i) => i.period).filter((x): x is string => Boolean(x)),
    ),
  ]
    .sort()
    .reverse();
  const shown = list.filter(
    (i) =>
      (status === 'all' || i.status === status) &&
      (month === 'all' || i.period === month) &&
      (room.trim() === '' || i.roomNumber.includes(room.trim())),
  );
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-11 items-center rounded-sm border px-3 text-ink',
      active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
      focusRing,
    );

  return (
    <>
      <div className="mb-4 flex flex-col gap-3">
        <nav aria-label={p.status.draft} className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={chip(status === s)}
            >
              {s === 'all' ? m.ownerLive.allStatuses : p.status[s]}
            </button>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label={m.ownerLive.allMonths}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="min-h-11 rounded-sm border border-line-strong bg-surface-raised px-3 text-ink tabular-nums"
          >
            <option value="all">{m.ownerLive.allMonths}</option>
            {months.map((mo) => (
              <option key={mo} value={mo}>
                {mo}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-ink-muted">
            <span>{m.ownerLive.searchRoom}</span>
            <input
              type="search"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="min-h-11 w-40 rounded-sm border border-line-strong bg-surface-raised px-3 text-ink tabular-nums"
            />
          </label>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-ink-muted">{m.ownerLive.empty}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((inv) => (
            <InvoiceRow
              key={inv.id}
              locale={locale}
              m={m}
              inv={inv}
              visitor={visitors.has(inv.id)}
              canVoid={role === 'owner'}
            />
          ))}
        </ul>
      )}
    </>
  );
}

type Row = ReturnType<typeof listView>[number];

function InvoiceRow({
  locale,
  m,
  inv,
  visitor,
  canVoid,
}: {
  locale: Locale;
  m: Messages;
  inv: Row;
  visitor: boolean;
  canVoid: boolean;
}) {
  const p = m.billing;
  const role = useRole();
  const [busy, setBusy] = useState(false);
  const draft = inv.status === 'draft';
  const linkOf = useCallback(
    () =>
      publicLinkFor(
        getStore().getState().data,
        inv.id,
        inv.publicToken,
        visitor,
        locale,
      ),
    [inv, visitor, locale],
  );

  const copy = async () => {
    const url = await linkOf();
    if (!url) return;
    await navigator.clipboard?.writeText(url);
    toast({ title: m.ownerLive.copied });
  };
  const open = async () => {
    const url = await linkOf();
    if (url) window.open(url, '_blank', 'noopener');
  };
  const dateText = inv.period ?? inv.dueDate;

  return (
    <li className="grid gap-x-4 gap-y-2 border-b border-line px-3 py-3 odd:bg-surface-sunken md:grid-cols-[1fr_1fr_1fr_auto_auto_auto]">
      <span className="tabular-nums text-ink">{inv.number}</span>
      <span className="tabular-nums text-ink">
        {inv.roomNumber}
        {inv.renterName ? (
          <span className="ml-2 text-ink-muted">{inv.renterName}</span>
        ) : null}
      </span>
      <span className="tabular-nums text-ink-muted">{dateText}</span>
      <span className="tabular-nums text-ink md:text-right">
        {formatMoney(inv.totalSatang, locale)}
      </span>
      <span className="text-ink-muted">
        {p.status[inv.status as keyof typeof p.status] ?? inv.status}
      </span>
      <span className="flex flex-wrap gap-2">
        {inv.status !== 'draft' && inv.status !== 'void' ? (
          <>
            <button
              type="button"
              onClick={() => void open()}
              className={cn(
                'min-h-11 rounded-sm px-2 text-ink underline-offset-4 hover:underline',
                focusRing,
              )}
            >
              {m.ownerLive.openInvoice}
            </button>
            <button
              type="button"
              onClick={() => void copy()}
              className={cn(
                'min-h-11 rounded-sm px-2 text-ink underline-offset-4 hover:underline',
                focusRing,
              )}
            >
              {m.ownerLive.copyLink}
            </button>
          </>
        ) : null}
        {draft && canVoid && role === 'owner' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              const result = actVoidDraft(
                { store: getStore(), role, now: () => new Date() },
                { invoiceId: inv.id },
              );
              setBusy(false);
              toast({
                title: result.ok ? m.ownerLive.voided : p.errors.saveFailed,
              });
            }}
            className={cn(
              'min-h-11 rounded-sm px-2 text-danger underline-offset-4 hover:underline',
              focusRing,
            )}
          >
            {m.ownerLive.voidDraft}
          </button>
        ) : null}
      </span>
      {role === 'owner' &&
      (inv.status === 'sent' || inv.status === 'partially_paid') ? (
        <div className="md:col-span-full">
          <CreditNoteForm
            locale={locale}
            invoiceId={inv.id}
            owedSatang={inv.balanceSatang}
          />
        </div>
      ) : null}
    </li>
  );
}
