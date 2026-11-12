'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { Button, cn, Field, focusRing, Input, toast, ts } from '@peera/ui';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  actMoveRoomType,
  actRemoveRoomType,
  actUpdateRoomType,
} from '@/src/client-store/commands/settings';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import type { Row } from '@/src/client-store/schema';
import { orderedRoomTypes } from '@/src/client-store/selectors/settings';
import type { StoreState } from '@/src/client-store/store';
import { commandContext, messageFor } from '@/src/components/live/OwnerEdits';
import { ReadyGate } from '@/src/components/live/ReadyGate';
import { PageHeader } from '@/src/components/PageHeader';
import { translator } from '@/src/i18n';
import { buildingsView } from './selectors';

type TypeRow = { type: Row<'room_type'>; uses: number };

/**
 * Room types (ux-v2/rentroll.md › Settings): each type's names and place in the order a new contract offers them.
 * Types move with the arrow buttons and the move is announced; a type can be removed only when no room uses it.
 */
export function RoomTypeSettings({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <Body locale={locale} />
    </ReadyGate>
  );
}

function Body({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const s = m.settings;
  const buildings = useStore(buildingsView);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];

  return (
    <>
      <PageHeader
        locale={locale}
        title={s.pages.roomTypes.title}
        description={s.pages.roomTypes.body}
      />
      <div className="flex max-w-[48rem] flex-col gap-5">
        <p className="m-0 text-ink-muted">{m.property.roomTypes.intro}</p>
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
                className={cn(
                  'inline-flex min-h-11 items-center rounded-sm border px-3 text-ink',
                  b.id === building?.id
                    ? 'border-ink bg-surface-sunken'
                    : 'border-line bg-surface-raised',
                  focusRing,
                )}
              >
                {locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh)}
              </button>
            ))}
          </div>
        ) : null}
        {building ? (
          <RoomTypeList key={building.id} locale={locale} building={building} />
        ) : null}
      </div>
    </>
  );
}

const iconButton = cn(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-40',
  focusRing,
);

function RoomTypeList({
  locale,
  building,
}: {
  locale: Locale;
  building: Row<'building'>;
}) {
  const { m, t, tp } = translator(locale);
  const s = m.settings;
  const role = useRole();
  const select = useCallback(
    (state: StoreState): TypeRow[] => {
      const rooms = state.data.room;
      return orderedRoomTypes(state.data, building.id).map((type) => ({
        type,
        uses: rooms.filter((room) => room.roomTypeId === type.id).length,
      }));
    },
    [building.id],
  );
  const rows = useStore(select);
  const [editing, setEditing] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // The arrow to focus once the list has re-rendered in its new order.
  const refocus = useRef<{ direction: 'up' | 'down'; id: string } | null>(null);

  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const own = document.getElementById(
      `type-${target.direction}-${target.id}`,
    ) as HTMLButtonElement | null;
    // At the end of the list the arrow is disabled: fall back to the other one.
    const other = document.getElementById(
      `type-${target.direction === 'up' ? 'down' : 'up'}-${target.id}`,
    );
    (own && !own.disabled ? own : other)?.focus();
  }, [rows]);

  const nameOf = (type: Row<'room_type'>) =>
    (locale === 'en' && type.nameEn) || type.nameTh;

  const move = (type: Row<'room_type'>, direction: 'up' | 'down') => {
    const result = actMoveRoomType(commandContext(role), {
      roomTypeId: type.id,
      direction,
    });
    if (!result.ok) {
      toast({ title: messageFor(m, result.error) });
      return;
    }
    setAnnouncement(
      t('settings.moved', {
        name: nameOf(type),
        position: result.value.position + 1,
      }),
    );
    refocus.current = { direction, id: type.id };
  };

  const remove = (type: Row<'room_type'>) => {
    const result = actRemoveRoomType(commandContext(role), {
      roomTypeId: type.id,
    });
    toast({
      title: result.ok ? s.removed : messageFor(m, result.error),
    });
  };

  if (rows.length === 0)
    return <p className="m-0 text-ink-muted">{m.property.roomTypes.empty}</p>;

  return (
    <div className="flex flex-col gap-2">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <p className="m-0 text-ink-muted">{s.roomTypesHint}</p>
      <ol className="m-0 flex list-none flex-col divide-y divide-line rounded-md border border-line bg-surface-raised p-0">
        {rows.map(({ type, uses }, index) =>
          editing === type.id ? (
            <li key={type.id} className="px-3 py-3">
              <RenameForm
                locale={locale}
                type={type}
                onDone={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={type.id}
              className="flex flex-wrap items-center gap-2 py-1 pr-1 pl-3"
            >
              <span
                aria-hidden
                className={cn(ts('ui', locale), 'w-6 shrink-0 text-ink-muted')}
              >
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col py-2">
                <span className={cn(ts('ui', locale), 'text-ink')}>
                  {nameOf(type)}
                </span>
                <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                  {uses === 0
                    ? s.unused
                    : `${tp('settings.inUse', uses)} · ${m.property.roomTypes.monthlyRent}: ${formatMoney(type.monthlyRentSatang, locale)}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center">
                <button
                  id={`type-up-${type.id}`}
                  type="button"
                  className={iconButton}
                  disabled={index === 0}
                  aria-label={t('settings.moveUp', { name: nameOf(type) })}
                  onClick={() => move(type, 'up')}
                >
                  <ArrowUp aria-hidden size={18} strokeWidth={1.75} />
                </button>
                <button
                  id={`type-down-${type.id}`}
                  type="button"
                  className={iconButton}
                  disabled={index === rows.length - 1}
                  aria-label={t('settings.moveDown', { name: nameOf(type) })}
                  onClick={() => move(type, 'down')}
                >
                  <ArrowDown aria-hidden size={18} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={t('settings.editName', { name: nameOf(type) })}
                  onClick={() => setEditing(type.id)}
                >
                  <Pencil aria-hidden size={18} strokeWidth={1.75} />
                </button>
                {uses === 0 ? (
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={t('settings.removeName', {
                      name: nameOf(type),
                    })}
                    onClick={() => remove(type)}
                  >
                    <Trash2 aria-hidden size={18} strokeWidth={1.75} />
                  </button>
                ) : null}
              </span>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

/** A type's two names in place; rents and terms are sample data and are not edited here. */
function RenameForm({
  locale,
  type,
  onDone,
}: {
  locale: Locale;
  type: Row<'room_type'>;
  onDone: () => void;
}) {
  const { m } = translator(locale);
  const s = m.settings;
  const p = m.property.roomTypes;
  const role = useRole();
  const [nameTh, setNameTh] = useState(type.nameTh);
  const [nameEn, setNameEn] = useState(type.nameEn ?? '');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = actUpdateRoomType(commandContext(role), {
      roomTypeId: type.id,
      nameTh,
      nameEn: nameEn.trim() === '' ? null : nameEn,
    });
    toast({
      title: result.ok ? s.roomTypeSaved : messageFor(m, result.error),
    });
    if (result.ok) onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <Field
        locale={locale}
        label={p.nameTh}
        required
        className="min-w-[10rem] flex-1"
      >
        <Input
          lang="th"
          value={nameTh}
          maxLength={60}
          required
          autoFocus
          onChange={(event) => setNameTh(event.target.value)}
        />
      </Field>
      <Field locale={locale} label={p.nameEn} className="min-w-[10rem] flex-1">
        <Input
          lang="en"
          value={nameEn}
          maxLength={60}
          onChange={(event) => setNameEn(event.target.value)}
        />
      </Field>
      <span className="flex gap-2">
        <Button locale={locale} type="submit" variant="primary">
          {m.common.save}
        </Button>
        <Button locale={locale} type="button" variant="ghost" onClick={onDone}>
          {m.common.cancel}
        </Button>
      </span>
    </form>
  );
}
