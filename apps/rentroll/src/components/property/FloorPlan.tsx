'use client';

import type { Locale } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import {
  AlertCircle,
  CalendarClock,
  DoorOpen,
  LogOut,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { RoomStatus } from '@/src/domain/property';
import { translator } from '@/src/i18n';

export type FloorPlanRoom = {
  roomId: string;
  number: string;
  floor: number;
  status: RoomStatus;
  renterName: string | null;
  daysPastDue: number;
  notice: boolean;
};

type Mark = { icon: LucideIcon; tone: string; word: string };

/** Rentroll's 12/13px metadata style (theme.css); not one of the shared type styles, so picked here. */
const caption = (locale: Locale) => (locale === 'th' ? 'caption-th' : 'caption');

/**
 * What a tile says about its room, most urgent first: overdue, notice given, closed for repair, reserved, vacant.
 * Every mark is an icon and a word as well as a colour; an occupied room in good standing has none.
 */
export function markOf(room: FloorPlanRoom, locale: Locale): Mark | null {
  const { m, tp } = translator(locale);
  if (room.daysPastDue > 0)
    return {
      icon: AlertCircle,
      tone: 'text-danger-ink',
      word: tp('property.rooms.overdueFor', room.daysPastDue),
    };
  if (room.notice)
    return { icon: LogOut, tone: 'text-warning', word: m.ownerLive.filterNotice };
  if (room.status === 'maintenance')
    return { icon: Wrench, tone: 'text-ink-muted', word: m.property.status.maintenance };
  if (room.status === 'reserved')
    return { icon: CalendarClock, tone: 'text-info', word: m.property.status.reserved };
  if (room.status === 'vacant')
    return { icon: DoorOpen, tone: 'text-ink-muted', word: m.property.status.vacant };
  return null;
}

/**
 * One room as a tile of the floor plan (ux-v2/rentroll.md › Motif): the room number in the numeric face, the tenant's
 * first name, and a corner mark with its word. A vacant room is a dashed outline on its own fill, so it reads without
 * colour. The tile is a link; its text is its accessible name.
 */
export function RoomTile({
  locale,
  room,
  href,
}: {
  locale: Locale;
  room: FloorPlanRoom;
  href: string;
}) {
  const { m } = translator(locale);
  const mark = markOf(room, locale);
  const vacant = room.status === 'vacant';
  const firstName = room.renterName?.split(' ')[0] ?? null;
  return (
    <Link
      prefetch={false}
      href={href}
      data-status={room.status}
      className={cn(
        'relative flex h-full min-h-[5.5rem] flex-col gap-1 rounded-[6px] border p-3 hover:border-ink',
        vacant
          ? 'border-dashed border-line-strong bg-room-vacant'
          : 'border-line bg-surface-raised',
        room.daysPastDue > 0 && 'border-danger',
        focusRing,
      )}
    >
      <span className="room-number text-ink">{room.number}</span>
      {firstName ? (
        <span className={cn(ts('body-sm', locale), 'truncate text-ink')}>
          {firstName}
        </span>
      ) : null}
      <span
        className={cn(
          caption(locale),
          'mt-auto',
          mark ? mark.tone : 'text-ink-muted',
        )}
      >
        {mark ? mark.word : m.property.status[room.status]}
      </span>
      {mark ? (
        <mark.icon
          aria-hidden
          size={16}
          strokeWidth={2}
          className={cn('absolute top-3 right-3', mark.tone)}
        />
      ) : null}
    </Link>
  );
}

/** The rooms of a building as floors of tiles, lowest floor first, each floor headed with its number and size. */
export function FloorPlan({
  locale,
  rooms,
  hrefOf,
}: {
  locale: Locale;
  rooms: FloorPlanRoom[];
  hrefOf: (room: FloorPlanRoom) => string;
}) {
  const { t, tp } = translator(locale);
  const floors = [...new Set(rooms.map((room) => room.floor))].sort(
    (a, b) => a - b,
  );
  return (
    <div className="grid gap-6">
      {floors.map((floor) => {
        const onFloor = rooms.filter((room) => room.floor === floor);
        const headingId = `floor-${floor}`;
        return (
          <section key={floor} aria-labelledby={headingId}>
            <h2
              id={headingId}
              className={cn(
                ts('label', locale),
                'm-0 mb-2 flex items-baseline gap-2 text-ink',
              )}
            >
              {t('property.rooms.floorTitle', { floor })}
              <span className={cn(caption(locale), 'text-ink-muted')}>
                {tp('property.rooms.roomsOnFloor', onFloor.length)}
              </span>
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
              {onFloor.map((room) => (
                <li key={room.roomId}>
                  <RoomTile locale={locale} room={room} href={hrefOf(room)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
