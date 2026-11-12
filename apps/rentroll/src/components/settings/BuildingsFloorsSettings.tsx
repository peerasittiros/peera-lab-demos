'use client';

import type { Locale } from '@peera/i18n';
import { Button, cn, Field, focusRing, Input, toast, ts } from '@peera/ui';
import { ArrowDown, ArrowUp, Pencil } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { actUpdateBuilding } from '@/src/client-store/commands/property';
import { actMoveFloor } from '@/src/client-store/commands/settings';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import type { Row } from '@/src/client-store/schema';
import { floorOrder } from '@/src/client-store/selectors/settings';
import type { StoreState } from '@/src/client-store/store';
import { commandContext, messageFor } from '@/src/components/live/OwnerEdits';
import { ReadyGate } from '@/src/components/live/ReadyGate';
import { PageHeader } from '@/src/components/PageHeader';
import { translator } from '@/src/i18n';
import { buildingsView } from './selectors';

/**
 * Buildings and floors (ux-v2/rentroll.md › Settings): each building's name, and the order its floors appear in on the
 * room map. A floor moves one place at a time with the arrow buttons; the new position is announced and focus stays on
 * the arrow that was pressed, so it can be pressed again.
 */
export function BuildingsFloorsSettings({ locale }: { locale: Locale }) {
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
  return (
    <>
      <PageHeader
        locale={locale}
        title={s.pages.buildings.title}
        description={s.pages.buildings.body}
      />
      <div className="flex max-w-[48rem] flex-col gap-8">
        {buildings.map((building) => (
          <BuildingBlock
            key={building.id}
            locale={locale}
            building={building}
          />
        ))}
      </div>
    </>
  );
}

const iconButton = cn(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-40',
  focusRing,
);

function BuildingBlock({
  locale,
  building,
}: {
  locale: Locale;
  building: Row<'building'>;
}) {
  const { t } = translator(locale);
  const [renaming, setRenaming] = useState(false);
  const name = (locale === 'en' && building.nameEn) || building.nameTh;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={cn(ts('title', locale), 'm-0 flex-1 text-ink')}>
          {name}
        </h2>
        {renaming ? null : (
          <button
            type="button"
            className={iconButton}
            aria-label={t('settings.editName', { name })}
            onClick={() => setRenaming(true)}
          >
            <Pencil aria-hidden size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {renaming ? (
        <RenameForm
          locale={locale}
          building={building}
          onDone={() => setRenaming(false)}
        />
      ) : null}
      <FloorOrder locale={locale} building={building} />
    </section>
  );
}

/** The building's names in place, saved through the same command the Building page uses. */
function RenameForm({
  locale,
  building,
  onDone,
}: {
  locale: Locale;
  building: Row<'building'>;
  onDone: () => void;
}) {
  const { m } = translator(locale);
  const p = m.property.buildings;
  const role = useRole();
  const [nameTh, setNameTh] = useState(building.nameTh);
  const [nameEn, setNameEn] = useState(building.nameEn ?? '');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = actUpdateBuilding(commandContext(role), {
      buildingId: building.id,
      nameTh,
      nameEn: nameEn.trim() === '' ? null : nameEn,
      promptpayId: building.promptpayId,
      billingDay: building.billingDay,
      dueDay: building.dueDay,
    });
    toast({
      title: result.ok ? m.settings.saved : messageFor(m, result.error),
    });
    if (result.ok) onDone();
  };

  return (
    <form
      onSubmit={submit}
      lang={locale}
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface-sunken p-4"
    >
      <Field
        locale={locale}
        label={p.nameTh}
        required
        className="min-w-[10rem] flex-1"
      >
        <Input
          lang="th"
          value={nameTh}
          maxLength={120}
          required
          autoFocus
          onChange={(event) => setNameTh(event.target.value)}
        />
      </Field>
      <Field locale={locale} label={p.nameEn} className="min-w-[10rem] flex-1">
        <Input
          lang="en"
          value={nameEn}
          maxLength={120}
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

type FloorRow = { floor: number; rooms: number };

function FloorOrder({
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
    (state: StoreState): FloorRow[] => {
      const rooms = state.data.room.filter(
        (room) => room.buildingId === building.id,
      );
      return floorOrder(state.data, building.id).map((floor) => ({
        floor,
        rooms: rooms.filter((room) => room.floor === floor).length,
      }));
    },
    [building.id],
  );
  const floors = useStore(select);
  const [announcement, setAnnouncement] = useState('');
  // The arrow to focus once the list has re-rendered in its new order.
  const refocus = useRef<{ direction: 'up' | 'down'; floor: number } | null>(
    null,
  );
  /** Floor numbers repeat across buildings, so an arrow's id carries the building too. */
  const arrowId = (direction: 'up' | 'down', floor: number) =>
    `${direction}-${building.id}-${floor}`;

  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const own = document.getElementById(
      arrowId(target.direction, target.floor),
    ) as HTMLButtonElement | null;
    // At the end of the list the arrow is disabled: fall back to the other one.
    const other = document.getElementById(
      arrowId(target.direction === 'up' ? 'down' : 'up', target.floor),
    );
    (own && !own.disabled ? own : other)?.focus();
  }, [floors]);

  const floorName = (floor: number) =>
    t('property.rooms.floorTitle', { floor });

  const move = (floor: number, direction: 'up' | 'down') => {
    const result = actMoveFloor(commandContext(role), {
      buildingId: building.id,
      floor,
      direction,
    });
    if (!result.ok) {
      toast({ title: messageFor(m, result.error) });
      return;
    }
    setAnnouncement(
      t('settings.moved', {
        name: floorName(floor),
        position: result.value.position + 1,
      }),
    );
    refocus.current = { direction, floor };
  };

  if (floors.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className={cn(ts('label', locale), 'm-0 text-ink')}>
        {s.floorsTitle}
      </h3>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ol className="m-0 flex list-none flex-col divide-y divide-line rounded-md border border-line bg-surface-raised p-0">
        {floors.map(({ floor, rooms }, index) => (
          <li
            key={floor}
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
                {floorName(floor)}
              </span>
              <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                {tp('property.rooms.roomsOnFloor', rooms)}
              </span>
            </span>
            <span className="flex shrink-0 items-center">
              <button
                id={arrowId('up', floor)}
                type="button"
                className={iconButton}
                disabled={index === 0}
                aria-label={t('settings.moveUp', { name: floorName(floor) })}
                onClick={() => move(floor, 'up')}
              >
                <ArrowUp aria-hidden size={18} strokeWidth={1.75} />
              </button>
              <button
                id={arrowId('down', floor)}
                type="button"
                className={iconButton}
                disabled={index === floors.length - 1}
                aria-label={t('settings.moveDown', { name: floorName(floor) })}
                onClick={() => move(floor, 'down')}
              >
                <ArrowDown aria-hidden size={18} strokeWidth={1.75} />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
