'use client';

import type { Locale } from '@peera/i18n';
import { Button, Checkbox, cn, focusRing, StatusBadge, toast, ts } from '@peera/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { syncMeterQueueNow } from '../../actions/meters';
import type { MeterRoomRow } from '../../db/queries/meters';
import { readingAnomaly } from '../../domain/anomaly';
import {
  mergeQueue,
  pendingItems,
  queueKey,
  refusedItems,
  type MeterKind,
  type QueuedReading,
} from '../../domain/meter-queue';
import { translator } from '../../i18n';
import { readQueue, writeQueue } from './meter-store';

/** Whole numbers only; anything else is not a reading. */
function parseReading(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** Units between two readings, or null when a lower reading is not confirmed as a rollover. */
function unitsFor(current: number, previous: number, digits: number, rollover: boolean): number | null {
  if (current >= previous) return current - previous;
  return rollover ? current + 10 ** digits - previous : null;
}

type RoomState = 'empty' | 'pending' | 'saved' | 'refused';

/**
 * The meter round for one building, floor and meter (01 §3.1 C.8). Values are queued on the device first and sent
 * when online; a queued value for a room replaces the earlier one, and the server is idempotent per room, meter
 * and period, so a retry never double-counts.
 */
export function MeterRound({
  locale,
  period,
  kind,
  rows,
}: {
  locale: Locale;
  period: string;
  kind: MeterKind;
  rows: MeterRoomRow[];
}) {
  const { m } = translator(locale);
  const router = useRouter();
  const p = m.meters;
  const [queue, setQueue] = useState<QueuedReading[]>([]);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [rollovers, setRollovers] = useState<Record<string, boolean>>({});
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const queueRef = useRef<QueuedReading[]>([]);
  const syncingRef = useRef(false);
  const syncRef = useRef<() => Promise<void>>(async () => {});
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const commit = (next: QueuedReading[]) => {
    queueRef.current = next;
    setQueue(next);
    void writeQueue(next);
  };

  const syncNow = async () => {
    if (syncingRef.current || !navigator.onLine) return;
    const pending = pendingItems(queueRef.current);
    if (pending.length === 0) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await syncMeterQueueNow({
        items: pending.map(({ key, roomId, kind: meter, period: when, reading, rollover, readAt }) => ({
          key,
          roomId,
          kind: meter,
          period: when,
          reading,
          rollover,
          readAt,
        })),
      });
      if (!result.ok) {
        toast({ title: p.syncFailed });
        return;
      }
      const outcome = new Map(result.data.results.map((r) => [r.key, r]));
      const next = queueRef.current.flatMap((item) => {
        const r = outcome.get(item.key);
        if (!r) return [item];
        if (r.ok) return [];
        return [{ ...item, error: r.messageKey ?? r.code ?? 'error' }];
      });
      commit(next);
      if ([...outcome.values()].some((r) => r.ok)) router.refresh();
    } catch {
      // No connection: the queue stays as it is and the next "online" event retries.
      setOnline(false);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  };
  syncRef.current = syncNow;

  useEffect(() => {
    let cancelled = false;
    const up = () => {
      setOnline(true);
      void syncRef.current();
    };
    const down = () => setOnline(false);
    void readQueue().then((items) => {
      if (cancelled) return;
      queueRef.current = items;
      setQueue(items);
      setOnline(navigator.onLine);
      void syncRef.current();
    });
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      cancelled = true;
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const stateOf = (row: MeterRoomRow): RoomState => {
    const queued = queue.find((q) => q.key === queueKey(row.roomId, kind, period));
    if (queued) return queued.error ? 'refused' : 'pending';
    return row.current !== null ? 'saved' : 'empty';
  };

  const saveRoom = (row: MeterRoomRow, rollover: boolean) => {
    const raw = typed[row.roomId];
    if (raw === undefined) return;
    const value = parseReading(raw);
    if (value === null) {
      toast({ title: p.invalid });
      return;
    }
    if (row.previous !== null && value < row.previous && !rollover) return;
    const next = mergeQueue(queueRef.current, {
      roomId: row.roomId,
      kind,
      period,
      reading: value,
      rollover,
      readAt: new Date().toISOString(),
    });
    setTyped((current) => {
      const copy = { ...current };
      delete copy[row.roomId];
      return copy;
    });
    commit(next);
    void syncRef.current();
  };

  const read = rows.filter((row) => stateOf(row) === 'saved' || stateOf(row) === 'pending').length;
  const pending = pendingItems(queue).length;
  const refused = refusedItems(queue);

  const nextRoom = () => {
    if (rows.length === 0) return;
    const start = activeId ? rows.findIndex((r) => r.roomId === activeId) : -1;
    for (let step = 1; step <= rows.length; step += 1) {
      const row = rows[(start + step) % rows.length]!;
      if (stateOf(row) === 'empty' || stateOf(row) === 'refused') {
        const input = inputs.current.get(row.roomId);
        input?.focus();
        input?.scrollIntoView({ block: 'center' });
        setActiveId(row.roomId);
        return;
      }
    }
    toast({ title: p.allRead });
  };

  if (rows.length === 0) return <p className="text-ink-muted">{p.empty}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-line bg-surface-raised py-3" lang={locale}>
        <p className={cn(ts('title', locale), 'text-ink')}>
          <span>{p.progressRead}</span> <span className="tabular-nums">{[read, rows.length].join(p.slash)}</span> <span>{p.progressRooms}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!online ? <StatusBadge tone="warning" label={p.offline} locale={locale} /> : null}
          {pending > 0 ? <StatusBadge tone="info" label={[p.pending, pending].join(' ')} locale={locale} /> : null}
          {refused.length > 0 ? (
            <StatusBadge tone="danger" label={[p.refused, refused.length].join(' ')} locale={locale} />
          ) : null}
          {syncing ? <span className="text-ink-muted">{p.syncing}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" locale={locale} onClick={nextRoom}>
            {p.nextRoom}
          </Button>
          <Button type="button" variant="secondary" locale={locale} onClick={() => void syncRef.current()} disabled={pending === 0 || syncing}>
            {p.syncNow}
          </Button>
        </div>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => {
          const queued = queue.find((q) => q.key === queueKey(row.roomId, kind, period));
          const state = stateOf(row);
          const shown = typed[row.roomId] ?? (queued ? String(queued.reading) : row.current !== null ? String(row.current) : '');
          const rollover = rollovers[row.roomId] ?? (queued ? queued.rollover : row.currentRollover);
          const current = parseReading(typed[row.roomId] ?? shown);
          const units = current !== null && row.previous !== null ? unitsFor(current, row.previous, row.digits, rollover) : null;
          const anomaly =
            current !== null && row.previous !== null
              ? anomalyFor(current, row.previous, units, rollover, row.averageUnits)
              : null;
          const inputId = `meter-${row.roomId}`;
          return (
            <li key={row.roomId}>
              <section className="flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4 md:p-5" lang={locale}>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className={cn(ts('headline-sm', locale), 'tabular-nums text-ink')}>{row.number}</h2>
                  <span className="text-ink-muted">
                    <span>{p.previous}</span>{' '}
                    <span className="tabular-nums">{row.previous ?? p.blank}</span>
                  </span>
                </div>
                <label htmlFor={inputId} className={cn(ts('body', locale), 'text-ink')}>
                  {[p.reading, p.kind[kind]].join(` ${p.dot} `)}
                </label>
                <input
                  id={inputId}
                  ref={(el) => {
                    if (el) inputs.current.set(row.roomId, el);
                    else inputs.current.delete(row.roomId);
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={shown}
                  onChange={(event) => setTyped((current) => ({ ...current, [row.roomId]: event.target.value }))}
                  onFocus={() => setActiveId(row.roomId)}
                  onBlur={() => saveRoom(row, rollover)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  className={cn(
                    'min-h-[44px] w-full rounded-sm border border-line-strong bg-surface px-3 text-ink tabular-nums',
                    ts('title', locale),
                    focusRing,
                  )}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-sm border border-line px-2 py-1 tabular-nums text-ink">
                    {units !== null ? units : p.blank} <span>{p.units}</span>
                  </span>
                  {state === 'saved' ? <StatusBadge tone="success" label={p.saved} locale={locale} /> : null}
                  {state === 'pending' ? <StatusBadge tone="info" label={p.pending} locale={locale} /> : null}
                  {state === 'refused' ? <StatusBadge tone="danger" label={p.refused} locale={locale} /> : null}
                </div>
                {state === 'refused' && queued?.error ? (
                  <p className="text-danger">{p.errors[queued.error.split('.').pop() as keyof typeof p.errors] ?? p.errors.saveFailed}</p>
                ) : null}
                {anomaly ? (
                  <div role="status" className="flex flex-col gap-2 rounded-sm border border-line bg-surface-sunken p-3">
                    <p className="text-ink">{p.anomaly[anomalyKey(anomaly)]}</p>
                    {anomaly === 'lower_than_previous' ? (
                      <Checkbox
                        locale={locale}
                        label={p.rollover}
                        checked={rollover}
                        onCheckedChange={(checked) => {
                          const next = checked === true;
                          setRollovers((current) => ({ ...current, [row.roomId]: next }));
                          if (typed[row.roomId] !== undefined) saveRoom(row, next);
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <button
                    type="button"
                    disabled
                    className={cn('min-h-[44px] rounded-sm border border-line px-3 text-ink-muted', focusRing)}
                  >
                    {p.photo}
                  </button>{' '}
                  <span className="text-ink-muted">{p.photoSoon}</span>
                </div>
              </section>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The banner for one reading. A lower reading is a question until the owner confirms a rollover; after that, the
 * reading is judged on the units it implies.
 */
function anomalyFor(
  current: number,
  previous: number,
  units: number | null,
  rollover: boolean,
  averageUnits: number | null,
): ReturnType<typeof readingAnomaly> {
  if (current < previous && !rollover) return 'lower_than_previous';
  // A confirmed rollover makes the reading "not lower" for the rule that checks usage.
  const base = current < previous ? current : previous;
  return readingAnomaly({ current, previous: base, units: units ?? 0, averageUnits });
}

function anomalyKey(anomaly: NonNullable<ReturnType<typeof readingAnomaly>>): 'lower' | 'high' | 'low' {
  if (anomaly === 'lower_than_previous') return 'lower';
  if (anomaly === 'above_double_average') return 'high';
  return 'low';
}
