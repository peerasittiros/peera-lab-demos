import { PageHeader } from '@/src/components/PageHeader';
import { loadRenters } from '@/src/db/queries/contracts';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';
import { cn, ts } from '@peera/ui';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const renters = await loadRenters(db, tenantId, bangkokDate(new Date()));
  const p = m.contracts.tenants;
  return (
    <>
      <PageHeader locale={locale} title={p.title} description={p.intro} />
      {renters.length === 0 ? (
        <p className="text-ink-muted">{p.none}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {renters.map((r) => (
            <li key={r.id} className="grid gap-x-6 gap-y-1 rounded-sm border border-line bg-surface-raised p-4 md:grid-cols-4">
              <span className={cn(ts('title', locale), 'text-ink')}>{r.name}</span>
              <span className="text-ink-muted">
                <span>{p.phone}</span> <span className="tabular-nums">{r.phone ?? m.contracts.blank}</span>
              </span>
              <span className="text-ink-muted">
                <span>{p.room}</span> <span className="tabular-nums">{r.roomNumber ?? m.contracts.blank}</span>
              </span>
              <span className="text-ink-muted">
                <span>{p.emergency}</span>{' '}
                <span>{r.emergencyContact ? `${r.emergencyContact.name} ${r.emergencyContact.phone}` : m.contracts.blank}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
