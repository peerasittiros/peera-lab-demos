import { PageHeader } from '@/src/components/PageHeader';
import { RoomMap } from '@/src/components/property/RoomMap';
import { loadProperty } from '@/src/db/queries/property';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext, param, type SearchParams } from '@/src/server/page';
import { cn, focusRing } from '@peera/ui';
import Link from 'next/link';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const query = await searchParams;
  const { buildings, rooms } = await loadProperty(db, tenantId, bangkokDate(new Date()));
  const chosen = buildings.find((b) => b.id === param(query.b)) ?? buildings[0];
  const inBuilding = rooms.filter((r) => r.buildingId === chosen?.id);
  return (
    <>
      <PageHeader locale={locale} title={m.property.rooms.title} description={m.property.rooms.intro} />
      <nav aria-label={m.property.rooms.building} className="mb-6 flex flex-wrap gap-2">
        {buildings.map((b) => (
          <Link
            key={b.id}
            href={`/${locale}/owner/rooms?b=${b.id}`}
            aria-current={b.id === chosen?.id ? 'page' : undefined}
            className={cn(
              'min-h-[44px] rounded-sm border px-4 py-2 text-ink',
              b.id === chosen?.id ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
              focusRing,
            )}
          >
            {locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh)}
          </Link>
        ))}
      </nav>
      {inBuilding.length === 0 ? (
        <p className="text-ink-muted">{m.property.rooms.empty}</p>
      ) : (
        <RoomMap locale={locale} rooms={inBuilding} basePath="/owner/rooms" />
      )}
    </>
  );
}
