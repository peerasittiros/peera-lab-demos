import { PageHeader } from '@/src/components/PageHeader';
import { loadContracts } from '@/src/db/queries/contracts';
import { pageContext } from '@/src/server/page';
import { cn, focusRing, ts } from '@peera/ui';
import { formatMoney } from '@peera/i18n';
import Link from 'next/link';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const contracts = await loadContracts(db, tenantId);
  const p = m.contracts;
  return (
    <>
      <PageHeader locale={locale} title={p.title} description={p.intro} />
      {contracts.length === 0 ? (
        <p className="text-ink-muted">{p.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {contracts.map((c) => (
            <li key={c.id}>
              <Link
                href={`/${locale}/owner/contracts/${c.id}`}
                className={cn(
                  'grid min-h-[44px] gap-x-6 gap-y-1 rounded-sm border border-line bg-surface-raised p-4 text-ink hover:bg-surface-sunken md:grid-cols-5',
                  focusRing,
                )}
              >
                <span className={cn(ts('title', locale), 'tabular-nums')}>{c.roomNumber}</span>
                <span>{c.renterName ?? m.contracts.blank}</span>
                <span className="tabular-nums text-ink-muted">{c.startDate}</span>
                <span className="tabular-nums text-ink-muted">{c.endDate ?? m.contracts.blank}</span>
                <span className="tabular-nums">{formatMoney(c.monthlyRentSatang, locale)}</span>
                <span className="text-ink-muted">{p.status[c.status as keyof typeof p.status] ?? c.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
