import { PageHeader } from '@/src/components/PageHeader';
import { BuildingForm } from '@/src/components/property/PropertyForms';
import { loadProperty } from '@/src/db/queries/property';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const { buildings } = await loadProperty(db, tenantId, bangkokDate(new Date()));
  return (
    <>
      <PageHeader locale={locale} title={m.property.buildings.title} description={m.property.buildings.intro} />
      <div className="flex flex-col gap-10">
        {buildings.map((b) => (
          <section key={b.id} className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
            <BuildingForm
              locale={locale}
              building={{ ...b, invoiceYearStyle: b.invoiceYearStyle === 'ce' ? 'ce' : 'be' }}
            />
          </section>
        ))}
      </div>
    </>
  );
}
