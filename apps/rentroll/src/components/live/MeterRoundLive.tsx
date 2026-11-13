'use client';

import { formatMoney, type Locale } from '@peera/i18n';
import { Button, cn, focusRing, SegmentedControl, ts } from '@peera/ui';
import { Delete } from 'lucide-react';
import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import { actSaveReading } from '@/src/client-store/commands/meters';
import { meterRound } from '@/src/client-store/selectors/meters';
import type { StoreState } from '@/src/client-store/store';
import type { MeterRoomRow } from '@/src/domain/billing-run';
import { amountFor, unitsFor, type MeterRates } from '@/src/domain/meter-entry';
import { ratePlanOn } from '@/src/domain/property';
import { formatPeriod, translator, type Messages } from '@/src/i18n';
import { ReadyGate } from './ReadyGate';

type Kind = 'electricity' | 'water';

/** Digits are the same in both languages (Thai readers use Arabic numerals on meters). */
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ZERO = '0';

const buildingsView = (s: StoreState) => s.data.building;
const periodOf = (s: StoreState) =>
  s.snapshotDate ? s.snapshotDate.slice(0, 7) : '';

/**
 * The meter round (ux-v2/rentroll.md V4). Phones read one room at a time with a big number pad, the units and the
 * amount worked out as the digits go in, and "save and go to the next room". From 768 it is a table per floor that
 * the keyboard drives: type a reading, press Enter, and the next room's field takes focus. Readings are saved to the
 * browser store at once, so it works offline. `period` is `current` or `YYYY-MM`.
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

/** The outcome of one save, for either view: an error to show, or the anomaly the store found (if any). */
type SaveResult =
  { ok: true; anomaly: string | null } | { ok: false; error: string };

function anomalyText(p: Messages['meters'], anomaly: string | null) {
  if (anomaly === 'lower_than_previous') return p.anomaly.lower;
  if (anomaly === 'above_double_average') return p.anomaly.high;
  if (anomaly === 'below_fifth_of_average') return p.anomaly.low;
  return null;
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
  const role = useRole();

  const period = requested === 'current' ? currentPeriod : requested;
  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];
  const select = useCallback(
    (s: StoreState) =>
      building && period ? meterRound(s.data, building.id, kind, period) : [],
    [building, kind, period],
  );
  const rows = useStore(select);
  const selectRates = useCallback(
    (s: StoreState): MeterRates | null =>
      building && s.snapshotDate
        ? ratePlanOn(
            s.data.rate_plan.filter((r) => r.buildingId === building.id),
            s.snapshotDate,
          )
        : null,
    [building],
  );
  const rates = useStore(selectRates);
  if (!building || !period) return null;

  const read = rows.filter((r) => r.current !== null).length;
  const canRead = role !== 'tenant';
  const save = async (
    row: MeterRoomRow,
    value: string,
    rollover: boolean,
  ): Promise<SaveResult> => {
    const result = await actSaveReading(
      { store: getStore(), role, now: () => new Date() },
      {
        roomId: row.roomId,
        meterKind: kind,
        period,
        reading: Number(value),
        rollover,
      },
    );
    if (!result.ok) {
      const last = result.error.split('.').pop() as keyof typeof p.errors;
      return { ok: false, error: p.errors[last] ?? p.errors.saveFailed };
    }
    return { ok: true, anomaly: result.value.anomaly };
  };
  const chip = (active: boolean) =>
    cn(
      ts('ui', locale),
      'inline-flex min-h-11 items-center rounded-sm border px-4 text-ink',
      active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
      focusRing,
    );
  const shared = { locale, m, kind, rates, rows, canRead, save };

  return (
    <>
      <p className="mb-4 text-ink-muted">{formatPeriod(period, locale)}</p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {buildings.length > 1
          ? buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={b.id === building.id}
                onClick={() => setBuildingId(b.id)}
                className={chip(b.id === building.id)}
              >
                {locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh)}
              </button>
            ))
          : null}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          locale={locale}
          aria-label={p.reading}
          value={kind}
          onValueChange={(next) => setKind(next as Kind)}
          options={[
            { value: 'electricity', label: p.kind.electricity },
            { value: 'water', label: p.kind.water },
          ]}
        />
        <p className="m-0 text-ink-muted" aria-live="polite">
          {p.progressRead}{' '}
          <span className="tabular-nums text-ink">{`${read}/${rows.length}`}</span>{' '}
          {p.progressRooms}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-muted">{p.empty}</p>
      ) : (
        <>
          {/* The key changes with the meter and the building, so a view starts fresh on its first unread room. */}
          <MeterStepper key={`${building.id}-${kind}`} {...shared} />
          <MeterTables key={`t-${building.id}-${kind}`} {...shared} />
        </>
      )}
      {rows.length > 0 && read === rows.length ? (
        <p role="status" className="mt-6 text-ink">
          {m.ownerLive.allRead}
        </p>
      ) : null}
    </>
  );
}

type ViewProps = {
  locale: Locale;
  m: Messages;
  kind: Kind;
  rates: MeterRates | null;
  rows: MeterRoomRow[];
  canRead: boolean;
  save: (
    row: MeterRoomRow,
    value: string,
    rollover: boolean,
  ) => Promise<SaveResult>;
};

/** Units and amount for a reading as typed, for both views. */
function Figures({
  locale,
  m,
  kind,
  rates,
  row,
  value,
  rollover,
  large = false,
}: {
  locale: Locale;
  m: Messages;
  kind: Kind;
  rates: MeterRates | null;
  row: MeterRoomRow;
  value: string;
  rollover: boolean;
  large?: boolean;
}) {
  const p = m.meters;
  const units = unitsFor(row, value, rollover);
  const amount = amountFor(rates, kind, units);
  const perPerson = kind === 'water' && rates?.waterMode === 'per_person';
  return (
    <dl className={cn('m-0 grid grid-cols-2 gap-3', large && 'gap-4')}>
      <div className="flex flex-col">
        <dt className={cn(ts('body-sm', locale), 'text-ink-muted')}>
          {p.units}
        </dt>
        <dd
          className={cn(
            'm-0 tabular-nums text-ink',
            large
              ? 'font-mono text-[22px] leading-8 font-semibold'
              : 'font-mono',
          )}
        >
          {units === null ? p.blank : units}
        </dd>
      </div>
      <div className="flex flex-col">
        <dt className={cn(ts('body-sm', locale), 'text-ink-muted')}>
          {p.amount}
        </dt>
        <dd
          className={cn(
            'm-0 tabular-nums text-ink',
            large
              ? 'font-mono text-[22px] leading-8 font-semibold'
              : 'font-mono',
          )}
        >
          {perPerson
            ? p.perPerson
            : amount === null
              ? p.blank
              : formatMoney(amount, locale)}
        </dd>
      </div>
    </dl>
  );
}

/** Phones: one room per view, the floor's progress as a strip, a number pad and "save and go to the next room". */
function MeterStepper({
  locale,
  m,
  kind,
  rates,
  rows,
  canRead,
  save,
}: ViewProps) {
  const { t } = translator(locale);
  const p = m.meters;
  const firstUnread = Math.max(
    0,
    rows.findIndex((r) => r.current === null),
  );
  const [index, setIndex] = useState(firstUnread);
  const row = rows[Math.min(index, rows.length - 1)]!;
  const [value, setValue] = useState(
    row.current === null ? '' : String(row.current),
  );
  const [rollover, setRollover] = useState(row.currentRollover);
  const [message, setMessage] = useState<ReactNode>(null);
  const floorRows = rows.filter((r) => r.floor === row.floor);

  const go = (next: number) => {
    const target = rows[next];
    if (!target) return;
    setIndex(next);
    setValue(target.current === null ? '' : String(target.current));
    setRollover(target.currentRollover);
    setMessage(null);
  };
  const press = (digit: string) =>
    setValue((current) => (current + digit).slice(0, row.digits));
  const lower =
    row.previous !== null && value !== '' && Number(value) < row.previous;

  const submit = async () => {
    const result = await save(row, value, rollover);
    if (!result.ok) {
      setMessage(
        <span role="alert" className="text-danger">
          {result.error}
        </span>,
      );
      return;
    }
    const warning = anomalyText(p, result.anomaly);
    if (warning) {
      // Stay on the room so the reader can check the meter again.
      setMessage(<span className="text-warning">{warning}</span>);
      return;
    }
    go(Math.min(index + 1, rows.length - 1));
    setMessage(
      <span className="text-success">{`${row.number} · ${p.saved}`}</span>,
    );
  };

  return (
    <section aria-label={p.reading} className="flex flex-col gap-4 md:hidden">
      <ol aria-hidden className="m-0 flex list-none gap-1 p-0">
        {floorRows.map((r) => (
          <li
            key={r.roomId}
            className={cn(
              'h-1.5 flex-1 rounded-xs',
              r.roomId === row.roomId
                ? 'bg-ink'
                : r.current !== null
                  ? 'bg-product-accent'
                  : 'bg-surface-sunken',
            )}
          />
        ))}
      </ol>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 font-mono text-[40px] leading-[44px] font-semibold tabular-nums text-ink">
          {row.number}
        </h2>
        <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
          {t('meters.roomOf', { index: index + 1, total: rows.length })}
        </span>
      </div>
      <p className="m-0 text-ink-muted">
        {p.previous}{' '}
        <span className="font-mono tabular-nums text-ink">
          {row.previous ?? p.blank}
        </span>
        {row.averageUnits !== null ? (
          <span>{` · ${m.ownerLive.average} ${Math.round(row.averageUnits)} ${p.units}`}</span>
        ) : null}
      </p>

      <output
        aria-live="polite"
        aria-label={p.reading}
        className="flex min-h-16 items-center justify-end rounded-sm border border-line-strong bg-surface-raised px-4 font-mono text-[36px] leading-10 tabular-nums text-ink"
      >
        {value === '' ? (
          <span className="text-ink-muted">{p.blank}</span>
        ) : (
          value
        )}
      </output>
      <Figures
        locale={locale}
        m={m}
        kind={kind}
        rates={rates}
        row={row}
        value={value}
        rollover={rollover}
        large
      />
      {lower || rollover ? (
        <label className="flex min-h-11 items-center gap-3 text-ink">
          <input
            type="checkbox"
            checked={rollover}
            onChange={(e) => setRollover(e.target.checked)}
            className="size-5"
          />
          <span>{p.rollover}</span>
        </label>
      ) : null}
      {message ? (
        <p className="m-0" aria-live="polite">
          {message}
        </p>
      ) : null}

      <div
        role="group"
        aria-label={p.keypad}
        className="grid grid-cols-3 gap-2"
      >
        {DIGITS.map((digit) => (
          <KeypadKey
            key={digit}
            disabled={!canRead}
            onPress={() => press(digit)}
          >
            {digit}
          </KeypadKey>
        ))}
        <KeypadKey
          disabled={!canRead || value === ''}
          onPress={() => setValue('')}
          small
          locale={locale}
        >
          {p.clear}
        </KeypadKey>
        <KeypadKey disabled={!canRead} onPress={() => press(ZERO)}>
          {ZERO}
        </KeypadKey>
        <KeypadKey
          disabled={!canRead || value === ''}
          onPress={() => setValue((current) => current.slice(0, -1))}
          label={p.backspace}
        >
          <Delete aria-hidden size={24} strokeWidth={1.75} />
        </KeypadKey>
      </div>

      <Button
        type="button"
        variant="primary"
        locale={locale}
        disabled={!canRead || value === ''}
        onClick={submit}
        className="min-h-14 w-full"
      >
        {p.saveNext}
      </Button>
      <div className="flex justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          locale={locale}
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          {p.prevRoom}
        </Button>
        <Button
          type="button"
          variant="ghost"
          locale={locale}
          disabled={index >= rows.length - 1}
          onClick={() => go(index + 1)}
        >
          {p.nextRoom}
        </Button>
      </div>
    </section>
  );
}

function KeypadKey({
  children,
  onPress,
  disabled,
  label,
  small = false,
  locale,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled: boolean;
  label?: string;
  small?: boolean;
  locale?: Locale;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex min-h-14 items-center justify-center rounded-sm border border-line bg-surface-raised text-ink active:bg-product-accent-soft disabled:opacity-50',
        small && locale
          ? ts('ui', locale)
          : 'font-mono text-[24px] tabular-nums',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

/** From 768: a table per floor; Enter saves the row and moves focus to the next room's field. */
function MeterTables({
  locale,
  m,
  kind,
  rates,
  rows,
  canRead,
  save,
}: ViewProps) {
  const { t } = translator(locale);
  const p = m.meters;
  const tableRef = useRef<HTMLDivElement>(null);
  const floors = [...new Set(rows.map((r) => r.floor))].sort((a, b) => a - b);
  const focusAfter = (roomId: string) => {
    const inputs = [
      ...(tableRef.current?.querySelectorAll<HTMLInputElement>(
        'input[data-room]',
      ) ?? []),
    ];
    const at = inputs.findIndex((input) => input.dataset.room === roomId);
    inputs[at + 1]?.focus();
    inputs[at + 1]?.select();
  };
  return (
    <div ref={tableRef} className="hidden flex-col gap-6 md:flex">
      <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
        {p.enterHint}
      </p>
      {floors.map((floor) => (
        <table
          key={floor}
          className="w-full border-collapse overflow-hidden rounded-sm border border-line bg-surface-raised text-left"
        >
          <caption
            className={cn(ts('label', locale), 'pb-2 text-left text-ink')}
          >
            {t('meters.table', { floor })}
          </caption>
          <thead>
            <tr
              className={cn(
                ts('body-sm', locale),
                'border-b border-line text-ink-muted',
              )}
            >
              <th scope="col" className="px-3 py-2 font-medium">
                {m.contracts.columns.room}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {p.previous}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {p.reading}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {p.units}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {p.amount}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {p.state}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => r.floor === floor)
              .map((row) => (
                <MeterTableRow
                  key={row.roomId}
                  locale={locale}
                  m={m}
                  kind={kind}
                  rates={rates}
                  row={row}
                  canRead={canRead}
                  save={save}
                  onSaved={() => focusAfter(row.roomId)}
                />
              ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

function MeterTableRow({
  locale,
  m,
  kind,
  rates,
  row,
  canRead,
  save,
  onSaved,
}: Omit<ViewProps, 'rows'> & { row: MeterRoomRow; onSaved: () => void }) {
  const p = m.meters;
  const [value, setValue] = useState(
    row.current === null ? '' : String(row.current),
  );
  const [rollover, setRollover] = useState(row.currentRollover);
  const [state, setState] = useState<ReactNode>(
    row.current === null ? (
      <span className="text-ink-muted">{p.notRead}</span>
    ) : (
      <span className="text-success">{p.saved}</span>
    ),
  );
  const units = unitsFor(row, value, rollover);
  const amount = amountFor(rates, kind, units);
  const perPerson = kind === 'water' && rates?.waterMode === 'per_person';
  const lower =
    row.previous !== null && value !== '' && Number(value) < row.previous;

  const onKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || value === '') return;
    event.preventDefault();
    const result = await save(row, value, rollover);
    if (!result.ok) {
      setState(
        <span role="alert" className="text-danger">
          {result.error}
        </span>,
      );
      return;
    }
    const warning = anomalyText(p, result.anomaly);
    setState(
      warning ? (
        <span className="text-warning">{warning}</span>
      ) : (
        <span className="text-success">{p.saved}</span>
      ),
    );
    onSaved();
  };

  return (
    <tr className="border-b border-line last:border-b-0">
      <th scope="row" className="room-number px-3 py-2 text-ink">
        {row.number}
      </th>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-muted">
        {row.previous ?? p.blank}
      </td>
      <td className="px-3 py-1 text-right">
        <input
          data-room={row.roomId}
          aria-label={`${row.number} ${p.reading}`}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          disabled={!canRead}
          onChange={(e) =>
            setValue(e.target.value.replace(/\D/g, '').slice(0, row.digits))
          }
          onKeyDown={onKeyDown}
          className={cn(
            'min-h-10 w-32 rounded-sm border border-line-strong bg-surface-raised px-3 text-right font-mono text-ink tabular-nums',
            focusRing,
          )}
        />
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
        {units === null ? p.blank : units}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-ink">
        {perPerson ? (
          <span className={ts('body-sm', locale)}>{p.perPerson}</span>
        ) : amount === null ? (
          p.blank
        ) : (
          formatMoney(amount, locale)
        )}
      </td>
      <td className={cn(ts('body-sm', locale), 'px-3 py-2')} aria-live="polite">
        {lower || rollover ? (
          <label className="flex min-h-10 items-center gap-2 text-ink">
            <input
              type="checkbox"
              checked={rollover}
              onChange={(e) => setRollover(e.target.checked)}
              className="size-4"
            />
            <span>{p.rollover}</span>
          </label>
        ) : (
          state
        )}
      </td>
    </tr>
  );
}
