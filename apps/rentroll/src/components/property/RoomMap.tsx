import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, StatusBadge, ts, type StatusTone } from '@peera/ui';
import Link from 'next/link';
import type { RoomStatus } from '../../domain/property';
import type { RoomView } from '../../db/queries/property';
import { firstName } from '../../db/queries/property';
import { translator } from '../../i18n';

const TONE: Record<RoomStatus, StatusTone> = {
  vacant: 'neutral',
  occupied: 'success',
  reserved: 'info',
  maintenance: 'warning',
};

/** Floors as rows, rooms as tiles (01 §8 screen 2). Status is always shown as a word and an icon, never colour alone. */
export function RoomMap({
  locale,
  rooms,
  basePath,
}: {
  locale: Locale;
  rooms: RoomView[];
  /** e.g. `/owner/rooms`: tiles link to `${basePath}/${id}`. */
  basePath: string;
}) {
  const { m } = translator(locale);
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  const label = (status: RoomStatus) => m.property.status[status];

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap gap-2" aria-label={m.property.rooms.legend}>
        {(Object.keys(TONE) as RoomStatus[]).map((status) => (
          <li key={status}>
            <StatusBadge tone={TONE[status]} label={label(status)} locale={locale} />
          </li>
        ))}
      </ul>
      {floors.map((floor) => (
        <section key={floor} aria-label={`${m.property.rooms.floor} ${floor}`} className="flex flex-col gap-2">
          <h2 className={cn(ts('label', locale), 'text-ink-muted')} lang={locale}>
            {m.property.rooms.floor} {floor}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {rooms
              .filter((r) => r.floor === floor)
              .map((room) => (
                <li key={room.id}>
                  <RoomTile locale={locale} room={room} href={`/${locale}${basePath}/${room.id}`} label={label(room.status)} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function RoomTile({ locale, room, href, label }: { locale: Locale; room: RoomView; href: string; label: string }) {
  const { m } = translator(locale);
  return (
    <Link
      href={href}
      lang={locale}
      className={cn(
        'flex min-h-[44px] flex-col gap-1 rounded-sm border border-line bg-surface-raised p-3 text-ink shadow-sm hover:bg-surface-sunken',
        focusRing,
      )}
    >
      <span className={cn(ts('headline-sm', locale), 'tabular-nums')}>{room.number}</span>
      <span className={cn(ts('body-sm', locale), 'truncate text-ink-muted')}>
        {room.renterName ? firstName(room.renterName) : '—'}
      </span>
      <StatusBadge tone={TONE[room.status]} label={label} locale={locale} />
      {room.overdueCount > 0 ? (
        <span className={cn(ts('body-sm', locale), 'text-danger')}>
          {m.property.rooms.overdue} {formatMoney(room.overdueSatang, locale)}
        </span>
      ) : null}
    </Link>
  );
}
