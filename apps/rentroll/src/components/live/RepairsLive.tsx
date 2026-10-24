'use client';

import type { Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Field,
  focusRing,
  Input,
  Select,
  Textarea,
  toast,
} from '@peera/ui';
import { useCallback, useState, type FormEvent } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import {
  actAddRepairNote,
  actCreateRepair,
  actMoveRepair,
  actUpdateRepair,
} from '@/src/client-store/commands/property';
import {
  repairsBoard,
  tenantTickets,
  ticketThread,
} from '@/src/client-store/selectors/repairs';
import { tenantContract } from '@/src/client-store/selectors/tenant';
import type { StoreState } from '@/src/client-store/store';
import {
  REPAIR_CATEGORIES,
  PREFERRED_TIMES,
  REPAIR_STATUSES,
  type RepairStatus,
} from '@/src/domain/repair';
import { translator, type Messages } from '@/src/i18n';
import { ReadyGate } from './ReadyGate';
import { Dot } from './KV';

const COLUMNS: RepairStatus[] = ['new', 'scheduled', 'in_progress', 'done'];
const boardView = (s: StoreState) => repairsBoard(s.data);
const contextOf = (role: ReturnType<typeof useRole>) => ({
  store: getStore(),
  role,
  now: () => new Date(),
});

const errorText = (m: Messages, key: string) => {
  const last = key.split('.').pop() as keyof Messages['ownerRepairs']['errors'];
  return m.ownerRepairs.errors[last] ?? m.ownerRepairs.errors.saveFailed;
};

/** The owner's repair board (SPEC §4 O15): tickets by status, one card each; the card's select moves it. */
export function RepairsBoardLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <RepairsBoardBody locale={locale} />
    </ReadyGate>
  );
}

function RepairsBoardBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.ownerRepairs;
  const tickets = useStore(boardView);
  const role = useRole();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = tickets.find((t) => t.id === openId) ?? null;

  if (tickets.length === 0) return <p className="text-ink-muted">{p.empty}</p>;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        {COLUMNS.map((status) => (
          <section
            key={status}
            aria-label={m.tenant.repairs.status[status]}
            className="flex flex-col gap-3"
          >
            <h2 className="text-ink">
              {m.tenant.repairs.status[status]}{' '}
              <span className="tabular-nums text-ink-muted">
                {tickets.filter((t) => t.status === status).length}
              </span>
            </h2>
            {tickets
              .filter((t) => t.status === status)
              .map((t) => (
                <article
                  key={t.id}
                  className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-3"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(t.id)}
                    className={cn('min-h-11 text-left text-ink', focusRing)}
                  >
                    <span className="tabular-nums">{t.roomNumber}</span>
                    <Dot />
                    {
                      m.tenant.repairs.category[
                        t.category as keyof typeof m.tenant.repairs.category
                      ]
                    }
                    <span className="block text-ink-muted">
                      {t.description}
                    </span>
                  </button>
                  <Select
                    locale={locale}
                    value={t.status}
                    aria-label={p.grab}
                    onValueChange={(value) => {
                      const result = actMoveRepair(contextOf(role), {
                        ticketId: t.id,
                        status: value as RepairStatus,
                      });
                      if (!result.ok)
                        toast({ title: errorText(m, result.error) });
                    }}
                    options={REPAIR_STATUSES.map((s) => ({
                      value: s,
                      label: m.tenant.repairs.status[s],
                    }))}
                  />
                </article>
              ))}
          </section>
        ))}
      </div>
      {open ? (
        <TicketPanel key={open.id} locale={locale} m={m} ticketId={open.id} />
      ) : null}
    </>
  );
}

/** One ticket: assignee, schedule, cost and billing, then its messages. */
function TicketPanel({
  locale,
  m,
  ticketId,
}: {
  locale: Locale;
  m: Messages;
  ticketId: string;
}) {
  const p = m.ownerRepairs;
  const role = useRole();
  const ticket = useStore(
    useCallback(
      (s: StoreState) =>
        s.data.repair_ticket.find((t) => t.id === ticketId) ?? null,
      [ticketId],
    ),
  );
  const thread = useStore(
    useCallback((s: StoreState) => ticketThread(s.data, ticketId), [ticketId]),
  );
  const [assignee, setAssignee] = useState(ticket?.assignee ?? '');
  const [scheduled, setScheduled] = useState(
    ticket?.scheduledAt ? ticket.scheduledAt.slice(0, 16) : '',
  );
  const [cost, setCost] = useState(
    ticket?.costSatang != null ? String(ticket.costSatang / 100) : '',
  );
  const [bill, setBill] = useState(ticket?.billToRenter ?? false);
  const [note, setNote] = useState('');
  if (!ticket) return null;

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const costSatang =
      cost.trim() === '' ? null : Math.round(Number(cost) * 100);
    const result = actUpdateRepair(contextOf(role), {
      ticketId,
      assignee: assignee.trim() === '' ? null : assignee.trim(),
      scheduledAt: scheduled === '' ? null : new Date(scheduled).toISOString(),
      costSatang,
      billToRenter: bill,
    });
    toast({ title: result.ok ? p.saved : errorText(m, result.error) });
  };

  const send = () => {
    const result = actAddRepairNote(contextOf(role), { ticketId, body: note });
    if (result.ok) setNote('');
    toast({ title: result.ok ? p.noted : errorText(m, result.error) });
  };

  return (
    <section
      aria-label={p.notes}
      className="mt-8 grid gap-6 rounded-sm border border-line bg-surface-raised p-4 md:grid-cols-2 md:p-6"
    >
      <form onSubmit={save} className="flex flex-col gap-4" lang={locale}>
        <Field label={p.assignee} locale={locale}>
          <Input
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          />
        </Field>
        <Field label={p.scheduled} locale={locale}>
          <Input
            type="datetime-local"
            value={scheduled}
            onChange={(e) => setScheduled(e.target.value)}
          />
        </Field>
        <Field label={p.cost} locale={locale}>
          <Input
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="tabular-nums"
          />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-ink">
          <input
            type="checkbox"
            checked={bill}
            onChange={(e) => setBill(e.target.checked)}
            className="size-5"
          />
          <span>{p.bill}</span>
        </label>
        <div>
          <Button type="submit" variant="secondary" locale={locale}>
            {p.save}
          </Button>
        </div>
      </form>
      <div className="flex flex-col gap-3">
        <h3 className="text-ink">{p.notes}</h3>
        {thread.length === 0 ? (
          <p className="text-ink-muted">{p.noNotes}</p>
        ) : null}
        <ol className="flex flex-col gap-2">
          {thread.map((msg) => (
            <li
              key={msg.id}
              className="rounded-sm bg-surface-sunken p-3 text-ink"
            >
              <span className="block text-ink-muted">{msg.authorRole}</span>
              {msg.body}
            </li>
          ))}
        </ol>
        <Field label={p.note} locale={locale}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div>
          <Button
            type="button"
            variant="secondary"
            locale={locale}
            disabled={note.trim() === ''}
            onClick={send}
          >
            {p.send}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** The tenant's repair requests and their timelines (SPEC §4 T5). */
export function TenantRepairsLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <TenantRepairsBody locale={locale} />
    </ReadyGate>
  );
}

const tenantView = (s: StoreState) =>
  s.snapshotDate ? tenantTickets(s.data, s.snapshotDate) : [];

function TenantRepairsBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.tenant.repairs;
  const tickets = useStore(tenantView);
  return (
    <>
      <p className="mb-6 text-ink-muted">{p.intro}</p>
      <a
        href={`/${locale}/t/repairs/new`}
        className={cn(
          'mb-6 inline-flex min-h-11 items-center rounded-sm bg-product-accent px-4 text-product-on-accent',
          focusRing,
        )}
      >
        {p.new}
      </a>
      {tickets.length === 0 ? <p className="text-ink-muted">{p.none}</p> : null}
      <ul className="flex flex-col gap-4">
        {tickets.map((t) => (
          <li
            key={t.id}
            className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-ink">
                {
                  m.tenant.repairs.category[
                    t.category as keyof typeof m.tenant.repairs.category
                  ]
                }
              </span>
              <span className="text-ink-muted">
                {
                  m.tenant.repairs.status[
                    t.status as keyof typeof m.tenant.repairs.status
                  ]
                }
              </span>
            </div>
            <p className="text-ink">{t.description}</p>
            <h2 className="mt-2 text-ink-muted">{p.updates}</h2>
            {t.messages.length === 0 ? (
              <p className="text-ink-muted">{p.noUpdates}</p>
            ) : null}
            <ol className="flex flex-col gap-1">
              {t.messages.map((msg) => (
                <li key={msg.id} className="text-ink">
                  {msg.body}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </>
  );
}

/** A new repair request (SPEC §4 T5): category, preferred time, allow entry, and the description. */
export function TenantRepairNewLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <RepairNewBody locale={locale} />
    </ReadyGate>
  );
}

function RepairNewBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.tenant.repairNew;
  const role = useRole();
  const room = useStore(
    useCallback(
      (s: StoreState) =>
        s.snapshotDate ? tenantContract(s.data, s.snapshotDate) : null,
      [],
    ),
  );
  const [category, setCategory] =
    useState<(typeof REPAIR_CATEGORIES)[number]>('electrical');
  const [time, setTime] = useState<(typeof PREFERRED_TIMES)[number]>('anytime');
  const [allowEntry, setAllowEntry] = useState(false);
  const [description, setDescription] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!room) return <p className="text-ink-muted">{m.tenant.home.none}</p>;
  if (sent) return <p className="text-ink">{p.sent}</p>;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = actCreateRepair(contextOf(role), {
      roomId: room.roomId,
      category,
      description,
      preferredTime: time,
      allowEntry,
    });
    if (!result.ok) return setError(errorText(m, result.error));
    setSent(true);
  };

  return (
    <form onSubmit={submit} lang={locale} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-ink">{p.category}</legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {REPAIR_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                'min-h-11 rounded-sm border px-3 py-2 text-ink',
                category === c
                  ? 'border-ink bg-surface-sunken'
                  : 'border-line bg-surface-raised',
                focusRing,
              )}
            >
              {m.tenant.repairs.category[c]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-ink">{p.time}</legend>
        <div className="flex flex-wrap gap-2">
          {PREFERRED_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={time === t}
              onClick={() => setTime(t)}
              className={cn(
                'min-h-11 rounded-sm border px-3 py-2 text-ink',
                time === t
                  ? 'border-ink bg-surface-sunken'
                  : 'border-line bg-surface-raised',
                focusRing,
              )}
            >
              {p.times[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-ink">
        <input
          type="checkbox"
          checked={allowEntry}
          onChange={(e) => setAllowEntry(e.target.checked)}
          className="size-5"
        />
        <span>{p.allowEntry}</span>
      </label>
      <Field label={p.description} locale={locale} required>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </Field>
      <p className="text-ink-muted">{p.photoSoon}</p>
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          variant="primary"
          locale={locale}
          disabled={description.trim() === ''}
        >
          {p.submit}
        </Button>
      </div>
    </form>
  );
}
