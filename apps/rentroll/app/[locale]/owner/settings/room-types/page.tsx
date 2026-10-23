import { PageHeader } from '@/src/components/PageHeader';
import { RoomTypeForm } from '@/src/components/property/PropertyForms';
import { loadProperty } from '@/src/db/queries/property';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const { buildings, roomTypes } = await loadProperty(db, tenantId, bangkokDate(new Date()));
  return (
    <>
      <PageHeader locale={locale} title={m.property.roomTypes.title} description={m.property.roomTypes.intro} />
      <div className="flex flex-col gap-10">
        {buildings.map((b) => (
          <section key={b.id} className="flex flex-col gap-6">
            {roomTypes
              .filter((t) => t.buildingId === b.id)
              .map((t) => (
                <div key={t.id} className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
                  <RoomTypeForm
                    locale={locale}
                    buildingId={b.id}
                    roomType={{
                      id: t.id,
                      nameTh: t.nameTh,
                      nameEn: t.nameEn,
                      monthlyRentSatang: t.monthlyRentSatang,
                      dailyRentSatang: t.dailyRentSatang,
                      depositSatang: t.depositSatang,
                      advanceMonths: t.advanceMonths,
                    }}
                  />
                </div>
              ))}
            <div className="rounded-sm border border-dashed border-line-strong p-4 md:p-5">
              <h2 className="mb-4 font-semibold text-ink">{m.property.roomTypes.add}</h2>
              <RoomTypeForm locale={locale} buildingId={b.id} />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
