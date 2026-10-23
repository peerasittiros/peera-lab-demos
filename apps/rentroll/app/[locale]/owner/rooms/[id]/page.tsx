import { PageHeader } from '@/src/components/PageHeader';
import { MaintenanceToggle, RoomForm } from '@/src/components/property/PropertyForms';
import { firstName, loadProperty } from '@/src/db/queries/property';
import { bangkokDate } from '@/src/domain/dates';
import type { RoomStatus } from '@/src/domain/property';
import { pageContext } from '@/src/server/page';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, StatusBadge, ts, type StatusTone } from '@peera/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const TONE: Record<RoomStatus, StatusTone> = {
  vacant: 'neutral',
  occupied: 'success',
  reserved: 'info',
  maintenance: 'warning',
};

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const { locale, db, tenantId, m } = await pageContext(params);
  const { buildings, roomTypes, rooms } = await loadProperty(db, tenantId, bangkokDate(new Date()));
  const room = rooms.find((r) => r.id === id);
  if (!room) notFound();
  const building = buildings.find((b) => b.id === room.buildingId);
  const p = m.property.room;
  const typeOptions = roomTypes
    .filter((t) => t.buildingId === room.buildingId)
    .map((t) => ({ id: t.id, name: locale === 'th' ? t.nameTh : (t.nameEn ?? t.nameTh) }));
  return (
    <>
      <Link
        href={`/${locale}/owner/rooms`}
        className={cn('mb-4 inline-flex min-h-[44px] items-center text-ink underline-offset-4 hover:underline', focusRing)}
      >
        {p.back}
      </Link>
      <PageHeader
        locale={locale}
        title={`${p.title} ${room.number}`}
        description={building ? (locale === 'th' ? building.nameTh : (building.nameEn ?? building.nameTh)) : undefined}
        actions={<StatusBadge tone={TONE[room.status]} label={m.property.status[room.status]} locale={locale} />}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          <h2 className={cn(ts('title', locale), 'mb-3 text-ink')}>{p.contract}</h2>
          {room.contractId ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-ink">
              <dt className="text-ink-muted">{p.renter}</dt>
              <dd>{room.renterName ? firstName(room.renterName) : '—'}</dd>
              <dt className="text-ink-muted">{p.contractStart}</dt>
              <dd className="tabular-nums">{room.contractStart}</dd>
              <dt className="text-ink-muted">{p.contractEnd}</dt>
              <dd className="tabular-nums">{room.contractEnd ?? '—'}</dd>
              {room.overdueCount > 0 ? (
                <>
                  <dt className="text-ink-muted">{m.property.rooms.overdue}</dt>
                  <dd className="text-danger">{formatMoney(room.overdueSatang, locale)}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="text-ink-muted">{p.noContract}</p>
          )}
        </section>
        <section className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          <h2 className={cn(ts('title', locale), 'mb-3 text-ink')}>{p.maintenance}</h2>
          <MaintenanceToggle locale={locale} roomId={room.id} maintenance={room.maintenance} />
        </section>
        <section className="rounded-sm border border-line bg-surface-raised p-4 md:col-span-2 md:p-5">
          <RoomForm
            locale={locale}
            buildingId={room.buildingId}
            room={{
              id: room.id,
              number: room.number,
              floor: room.floor,
              roomTypeId: room.roomTypeId,
              sizeSqm: room.sizeSqm,
              elecMeterDigits: room.elecMeterDigits,
              waterMeterDigits: room.waterMeterDigits,
              sort: room.sort,
              maintenance: room.maintenance,
            }}
            roomTypes={typeOptions}
          />
        </section>
      </div>
    </>
  );
}
