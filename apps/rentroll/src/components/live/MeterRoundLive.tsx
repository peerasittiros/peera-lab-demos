'use client';

import type { Locale } from '@peera/i18n';
import { Button, cn, focusRing, toast } from '@peera/ui';
import { useCallback, useState, type FormEvent } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import type { Role } from '@/src/client-store/schema';
import { actSaveReading } from '@/src/client-store/commands/meters';
import { meterRound } from '@/src/client-store/selectors/meters';
import type { StoreState } from '@/src/client-store/store';
import type { MeterRoomRow } from '@/src/domain/billing-run';
import { translator, type Messages } from '@/src/i18n';
import { ReadyGate } from './ReadyGate';

type Kind = 'electricity' | 'water';

const buildingsView = (s: StoreState) => s.data.building;
const periodOf = (s: StoreState) =>
  s.snapshotDate ? s.snapshotDate.slice(0, 7) : '';

/**
 * The meter round (SPEC §4 O9): one room per row, floor by floor. A reading is checked against the room's history and
 * saved to the store at once, so it works offline too. `period` is `current` or `YYYY-MM`.
 */
export function MeterRoundLive({
  locale,
  period: requested,
}: {
  locale: Locale;
  period: string;
}) {
  return (
    <ReadyGate locale={locale}>
      <MeterRoundBody locale={locale} requested={requested} />
    </ReadyGate>
  );
}

function MeterRoundBody({
  locale,
  requested,
}: {
  locale: Locale;
  requested: string;
}) {
  const { m } = translator(locale);
  const p = m.meters;
  const buildings = useStore(buildingsView);
  const currentPeriod = useStore(periodOf);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>('electricity');
  const [floor, setFloor] = useState<number | null>(null);
  const role = useRole();

  const period = requested === 'current' ? currentPeriod : requested;
  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];
  const select = useCallback(
    (s: StoreState) =>
      building && period ? meterRound(s.data, building.id, kind, period) : [],
    [building, kind, period],
  );
  const all = useStore(select);
  if (!building || !period) return null;

  const floors = [...new Set(all.map((r) => r.floor))].sort((a, b) => a - b);
  const rows = floor === null ? all : all.filter((r) => r.floor === floor);
  const read = all.filter((r) => r.current !== null).length;
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-11 items-center rounded-sm border px-4 text-ink',
      active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
      focusRing,
    );
  const buildingName = (b: (typeof buildings)[number]) =>
    locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh);

  return (
    <>
      <p className="mb-4 tabular-nums text-ink-muted">{period}</p>
      <nav aria-label={p.building} className="mb-3 flex flex-wrap gap-2">
        {buildings.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={b.id === building.id}
            onClick={() => setBuildingId(b.id)}
            className={chip(b.id === building.id)}
          >
            {buildingName(b)}
          </button>
        ))}
      </nav>
      <nav
        aria-label={p.kind.electricity}
        className="mb-3 flex flex-wrap gap-2"
      >
        {(['electricity', 'water'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={chip(kind === k)}
          >
            {p.kind[k]}
          </button>
        ))}
      </nav>
      <nav aria-label={p.floor} className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={floor === null}
          onClick={() => setFloor(null)}
          className={chip(floor === null)}
        >
          {p.all}
        </button>
        {floors.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={floor === f}
            onClick={() => setFloor(f)}
            className={chip(floor === f)}
          >
            <span>{p.floor}</span> <span className="tabular-nums">{f}</span>
          </button>
        ))}
      </nav>
      <p className="mb-4 text-ink-muted" aria-live="polite">
        <span className="tabular-nums text-ink">{`${read}/${all.length}`}</span>{' '}
        {m.ownerLive.readCount}
      </p>

      {all.length === 0 ? (
        <p className="text-ink-muted">{p.empty}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <MeterRow
              key={`${row.roomId}-${kind}-${period}`}
              locale={locale}
              m={m}
              row={row}
              kind={kind}
              period={period}
              canRead={role !== 'tenant'}
              role={role}
            />
          ))}
        </ul>
      )}
      {all.length > 0 && read === all.length ? (
        <p className="mt-6 text-ink">{m.ownerLive.allRead}</p>
      ) : null}
    </>
  );
}

const ANOMALY_TEXT = (
  p: Messages['meters'],
  anomaly: string | null,
): string | null => {
  if (anomaly === 'lower_than_previous') return p.anomaly.lower;
  if (anomaly === 'above_double_average') return p.anomaly.high;
  if (anomaly === 'below_fifth_of_average') return p.anomaly.low;
  return null;
};

function MeterRow({
  locale,
  m,
  row,
  kind,
  period,
  canRead,
  role,
}: {
  locale: Locale;
  m: Messages;
  row: MeterRoomRow;
  kind: Kind;
  period: string;
  canRead: boolean;
  role: Role;
}) {
  const p = m.meters;
  const [value, setValue] = useState(
    row.current === null ? '' : String(row.current),
  );
  const [rollover, setRollover] = useState(row.currentRollover);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(row.current !== null);
  const [anomaly, setAnomaly] = useState<string | null>(row.currentAnomaly);
  const lowerThanPrevious =
    row.previous !== null && value !== '' && Number(value) < row.previous;

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reading = Number(value);
    const result = actSaveReading(
      { store: getStore(), role, now: () => new Date() },
      { roomId: row.roomId, meterKind: kind, period, reading, rollover },
    );
    if (!result.ok) {
      const last = result.error.split('.').pop() as keyof typeof p.errors;
      setError(p.errors[last] ?? p.errors.saveFailed);
      setSaved(false);
      return;
    }
    setError(null);
    setSaved(true);
    setAnomaly(result.value.anomaly);
    toast({ title: p.saved });
  };

  const anomalyText = ANOMALY_TEXT(p, anomaly);
  return (
    <li className="flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-ink tabular-nums">{row.number}</h2>
        <span className="text-ink-muted tabular-nums">
          <span>{m.ownerLive.previousReading}</span>{' '}
          <span>{row.previous ?? p.blank}</span>
          {row.averageUnits !== null
            ? ` · ${m.ownerLive.average}: ${Math.round(row.averageUnits)}`
            : ''}
        </span>
      </div>
      <form onSubmit={save} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-ink-muted">
          <span>{p.reading}</span>
          <input
            name="reading"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) =>
              setValue(e.target.value.replace(/\D/g, '').slice(0, row.digits))
            }
            disabled={!canRead}
            className="min-h-11 w-40 rounded-sm border border-line-strong bg-surface-raised px-3 text-right text-ink tabular-nums"
          />
        </label>
        {lowerThanPrevious || rollover ? (
          <label className="flex min-h-11 items-center gap-2 text-ink">
            <input
              type="checkbox"
              checked={rollover}
              onChange={(e) => setRollover(e.target.checked)}
              className="size-5"
            />
            <span>{p.rollover}</span>
          </label>
        ) : null}
        <Button
          type="submit"
          variant="secondary"
          locale={locale}
          disabled={!canRead || value === ''}
        >
          {m.common.save}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {saved && !error ? (
          <span className="text-success">{p.saved}</span>
        ) : null}
        {anomalyText ? (
          <span className="text-warning">{anomalyText}</span>
        ) : null}
        {error ? (
          <span role="alert" className="text-danger">
            {error}
          </span>
        ) : null}
      </div>
    </li>
  );
}
