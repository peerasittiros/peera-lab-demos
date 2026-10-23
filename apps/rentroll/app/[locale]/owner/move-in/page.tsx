import { PageHeader } from '@/src/components/PageHeader';
import { MoveInForm, type RoomChoice } from '@/src/components/contracts/ContractForms';
import { loadRenters } from '@/src/db/queries/contracts';
import { loadProperty } from '@/src/db/queries/property';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext, param, type SearchParams } from '@/src/server/page';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const query = await searchParams;
  const today = bangkokDate(new Date());
  const [{ buildings, roomTypes, rooms }, renters] = await Promise.all([
    loadProperty(db, tenantId, today),
    loadRenters(db, tenantId, today),
  ]);
  const typeById = new Map(roomTypes.map((t) => [t.id, t]));
  const vacant: RoomChoice[] = rooms
    .filter((r) => r.status === 'vacant')
    .map((r) => {
      const type = typeById.get(r.roomTypeId);
      const building = buildings.find((b) => b.id === r.buildingId);
      const buildingName = locale === 'th' ? building?.nameTh : (building?.nameEn ?? building?.nameTh);
      return {
        id: r.id,
        label: `${buildingName ?? ''} · ${r.number}`,
        monthlyRentSatang: type?.monthlyRentSatang ?? 0,
        depositSatang: type?.depositSatang ?? 0,
        advanceMonths: type?.advanceMonths ?? 1,
      };
    });
  const requested = param(query.room);
  const initialRoomId = vacant.some((r) => r.id === requested) ? requested! : null;
  return (
    <>
      <PageHeader locale={locale} title={m.contracts.moveIn.title} description={m.contracts.moveIn.intro} />
      <MoveInForm
        locale={locale}
        rooms={vacant}
        renters={renters.map((r) => ({ id: r.id, name: r.name }))}
        initialRoomId={initialRoomId}
        today={today}
      />
    </>
  );
}
