import { PageHeader } from '@/src/components/PageHeader';
import { RatePlanForm } from '@/src/components/property/PropertyForms';
import { loadProperty } from '@/src/db/queries/property';
import { bangkokDate } from '@/src/domain/dates';
import { ratePlanOn } from '@/src/domain/property';
import { formatMoney } from '@peera/i18n';
import { pageContext } from '@/src/server/page';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const today = bangkokDate(new Date());
  const { buildings, ratePlans } = await loadProperty(db, tenantId, today);
  return (
    <>
      <PageHeader locale={locale} title={m.property.rates.title} description={m.property.rates.intro} />
      <div className="flex flex-col gap-10">
        {buildings.map((b) => {
          const plans = ratePlans
            .filter((p) => p.buildingId === b.id)
            .sort((x, y) => y.validFrom.localeCompare(x.validFrom));
          const current = ratePlanOn(plans, today);
          return (
            <section key={b.id} className="flex flex-col gap-6">
              <div className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
                <h2 className="mb-2 font-semibold text-ink">{m.property.rates.current}</h2>
                {current ? (
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-ink md:grid-cols-3">
                    <dt className="text-ink-muted">{m.property.rates.validFrom}</dt>
                    <dd className="tabular-nums">{current.validFrom}</dd>
                    <dt className="text-ink-muted">{m.property.rates.electricityRate}</dt>
                    <dd>{formatMoney(current.elecRateSatang, locale)}</dd>
                    <dt className="text-ink-muted">{m.property.rates.commonFee}</dt>
                    <dd>{formatMoney(current.commonFeeSatang, locale)}</dd>
                  </dl>
                ) : (
                  <p className="text-ink-muted">{m.property.rates.none}</p>
                )}
              </div>
              <div className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
                <h2 className="mb-2 font-semibold text-ink">{m.property.rates.history}</h2>
                <ul className="flex flex-col gap-1 text-ink">
                  {plans.map((p) => (
                    <li key={p.id} className="tabular-nums">
                      {p.validFrom}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
                <h2 className="mb-4 font-semibold text-ink">{m.property.rates.newPlan}</h2>
                <RatePlanForm locale={locale} buildingId={b.id} />
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
