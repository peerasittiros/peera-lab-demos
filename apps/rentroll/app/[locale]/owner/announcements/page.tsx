import { PageHeader } from '@/src/components/PageHeader';
import { AnnouncementForm } from '@/src/components/tenant/TenantForms';
import { loadAnnouncements } from '@/src/db/queries/tenant';
import { loadProperty } from '@/src/db/queries/property';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';
import { cn, ts } from '@peera/ui';

/** Owner posts a notice for the building; every tenant home shows it (01 §3.1 D.16). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const today = bangkokDate(new Date());
  const { buildings } = await loadProperty(db, tenantId, today);
  const building = buildings[0];
  const posted = building ? await loadAnnouncements(db, tenantId, building.id, today) : [];
  const p = m.tenant.owner.announce;
  return (
    <>
      <PageHeader locale={locale} title={p.title} description={p.intro} />
      {building ? <AnnouncementForm locale={locale} buildingId={building.id} /> : null}
      <section className="mt-10 flex flex-col gap-3">
        {posted.length === 0 ? (
          <p className="text-ink-muted">{p.none}</p>
        ) : (
          posted.map((a) => (
            <article key={a.id} className="rounded-sm border border-line bg-surface-raised p-4">
              <h2 className={cn(ts('title', locale), 'text-ink')}>{locale === 'th' ? a.titleTh : a.titleEn}</h2>
              <p className="text-ink">{locale === 'th' ? a.bodyTh : a.bodyEn}</p>
            </article>
          ))
        )}
      </section>
    </>
  );
}
