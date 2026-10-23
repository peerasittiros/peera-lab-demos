'use client';

import type { BoardTicket } from '../../db/queries/repairs';
import { canMove, REPAIR_STATUSES, type RepairStatus } from '../../domain/repair';
import { addRepairNoteNow, updateRepairNow } from '../../actions/repairs';
import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { Button, cn, Field, Input, Select, Switch, toast, ts } from '@peera/ui';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { translator, type Messages } from '../../i18n';

/** A timestamp as the Bangkok wall-clock value a datetime-local input expects. */
function toBangkokInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function fromBangkokInput(value: string): string | null {
  return value ? new Date(`${value}:00+07:00`).toISOString() : null;
}

function failureText(m: Messages, messageKey: string): string {
  const key = messageKey.split('.').pop() as keyof Messages['ownerRepairs']['errors'];
  return m.ownerRepairs.errors[key] ?? m.ownerRepairs.errors.saveFailed;
}

/**
 * The owner's board (01 §8 screen 11). Drag a card to another column, or focus its Move handle and press space, then
 * the arrow keys, then space. A move shows at once and is saved; if the save is refused, the card goes back.
 */
export function RepairBoard({ locale, tickets, now }: { locale: Locale; tickets: BoardTicket[]; now: string }) {
  const { m } = translator(locale);
  const p = m.ownerRepairs;
  const router = useRouter();
  const [moved, setMoved] = useState<Record<string, RepairStatus>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // A refresh brings the saved statuses back, so the optimistic ones can go.
  useEffect(() => {
    setMoved({});
  }, [tickets]);

  const statusOf = (ticket: BoardTicket): RepairStatus => moved[ticket.id] ?? (ticket.status as RepairStatus);

  const onDragEnd = (event: DragEndEvent) => {
    const id = String(event.active.id);
    const target = event.over?.id as RepairStatus | undefined;
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket || !target) return;
    const from = statusOf(ticket);
    if (!canMove(from, target)) return;
    setMoved((current) => ({ ...current, [id]: target }));
    void updateRepairNow({ ticketId: id, status: target }).then((result) => {
      if (!result.ok) {
        setMoved((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        toast({ title: failureText(m, result.error.messageKey) });
        return;
      }
      toast({ title: p.saved });
      router.refresh();
    });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" lang={locale}>
        {REPAIR_STATUSES.map((status) => {
          const inColumn = tickets.filter((t) => statusOf(t) === status);
          return (
            <Column key={status} locale={locale} id={status} title={m.tenant.repairs.status[status]} count={inColumn.length} emptyText={p.empty}>
              {inColumn.map((ticket) => (
                <RepairCard key={ticket.id} locale={locale} ticket={ticket} status={status} now={now} />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}

/** A status column: a drop target that lights up while a card is over it. */
function Column({
  locale,
  id,
  title,
  count,
  emptyText,
  children,
}: {
  locale: Locale;
  id: RepairStatus;
  title: string;
  count: number;
  emptyText: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`col-${id}`}
      className={cn(
        'flex min-h-[8rem] flex-col gap-3 rounded-sm p-2 transition-colors motion-reduce:transition-none',
        isOver ? 'bg-surface-sunken outline outline-2 outline-offset-2 outline-focus-ring' : '',
      )}
    >
      <h2 id={`col-${id}`} className={cn(ts('title', locale), 'text-ink')}>
        {title} <span className="tabular-nums text-ink-muted">{count}</span>
      </h2>
      {count === 0 ? <p className="text-ink-muted">{emptyText}</p> : null}
      {children}
    </section>
  );
}

function RepairCard({
  locale,
  ticket,
  status,
  now,
}: {
  locale: Locale;
  ticket: BoardTicket;
  status: RepairStatus;
  now: string;
}) {
  const { m } = translator(locale);
  const router = useRouter();
  const p = m.ownerRepairs;
  const { attributes, listeners, setNodeRef: setDragNode, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });
  const [assignee, setAssignee] = useState(ticket.assignee ?? '');
  const [scheduled, setScheduled] = useState(toBangkokInput(ticket.scheduledAt));
  const [cost, setCost] = useState(ticket.costSatang ? String(ticket.costSatang / 100) : '');
  const [bill, setBill] = useState(ticket.billToRenter);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'save' | 'note' | null>(null);
  const daysOpen = Math.max(0, Math.floor((new Date(now).getTime() - new Date(ticket.createdAt).getTime()) / 86_400_000));

  const save = async (next: RepairStatus = status) => {
    setBusy('save');
    const costSatang = cost.trim() === '' ? null : Math.round(Number(cost) * 100);
    const result = await updateRepairNow({
      ticketId: ticket.id,
      status: next,
      assignee: assignee.trim() === '' ? null : assignee.trim(),
      scheduledAt: fromBangkokInput(scheduled),
      costSatang,
      billToRenter: bill,
    });
    setBusy(null);
    if (!result.ok) {
      toast({ title: failureText(m, result.error.messageKey) });
      return;
    }
    toast({ title: p.saved });
    router.refresh();
  };

  const sendNote = async () => {
    setBusy('note');
    const result = await addRepairNoteNow({ ticketId: ticket.id, body: note.trim() });
    setBusy(null);
    if (!result.ok) {
      toast({ title: failureText(m, result.error.messageKey) });
      return;
    }
    setNote('');
    toast({ title: p.noted });
    router.refresh();
  };

  return (
    <article
      ref={setDragNode}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        'relative flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4',
        isDragging ? 'z-10 shadow-lift' : '',
      )}
      lang={locale}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={cn(ts('title', locale), 'tabular-nums text-ink')}>{ticket.roomNumber}</span>
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`${p.grab} ${ticket.roomNumber}`}
          className="min-h-[44px] cursor-grab rounded-sm border border-line-strong bg-surface px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          {...listeners}
          {...attributes}
        >
          {p.grab}
        </button>
      </div>
      <span className="text-ink-muted">{m.tenant.repairs.category[ticket.category as keyof typeof m.tenant.repairs.category] ?? ticket.category}</span>
      <p className="text-ink">{ticket.description}</p>
      <p className="text-ink-muted">
        <span>{p.daysOpen}</span> <span className="tabular-nums">{daysOpen}</span>
      </p>

      <Field label={p.status} locale={locale}>
        <Select
          locale={locale}
          value={status}
          onValueChange={(value) => void save(value as RepairStatus)}
          options={REPAIR_STATUSES.map((s) => ({ value: s, label: m.tenant.repairs.status[s] }))}
        />
      </Field>
      <Field label={p.assignee} locale={locale}>
        <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} />
      </Field>
      <Field label={p.scheduled} locale={locale}>
        <Input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
      </Field>
      <Field label={p.cost} locale={locale}>
        <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
      </Field>
      <Switch locale={locale} label={p.bill} checked={bill} onCheckedChange={setBill} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" locale={locale} loading={busy === 'save'} onClick={() => void save()}>
          {p.save}
        </Button>
        {status !== 'done' && status !== 'cancelled' ? (
          <Button type="button" variant="ghost" locale={locale} disabled={busy !== null} onClick={() => void save('done')}>
            {p.close}
          </Button>
        ) : null}
      </div>

      <section className="flex flex-col gap-2 border-t border-line pt-3">
        <h3 className="text-ink-muted">{p.notes}</h3>
        {ticket.messages.length === 0 ? (
          <p className="text-ink-muted">{p.noNotes}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {ticket.messages.map((msg) => (
              <li key={msg.id} className="text-ink">
                <span className="text-ink-muted">{msg.authorRole}</span> {msg.body}
              </li>
            ))}
          </ul>
        )}
        <Field label={p.note} locale={locale}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div>
          <Button type="button" variant="secondary" locale={locale} loading={busy === 'note'} disabled={note.trim() === ''} onClick={() => void sendNote()}>
            {p.send}
          </Button>
        </div>
      </section>
      {ticket.costSatang ? <p className="text-ink-muted">{formatMoney(ticket.costSatang, locale)}</p> : null}
    </article>
  );
}
