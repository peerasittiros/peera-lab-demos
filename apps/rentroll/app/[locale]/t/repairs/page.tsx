import { PageHeader } from '@/src/components/PageHeader';
import { LiveRefresh } from '@/src/components/tenant/TenantForms';
import { loadRepairs, tenantContract } from '@/src/db/queries/tenant';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';
import { cn, focusRing } from '@peera/ui';
import Link from 'next/link';

/** The tenant's repair requests, each with its status and messages (01 §3.1 D.15). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const p = m.tenant.repairs;
  const current = await tenantContract(db, tenantId, bangkokDate(new Date()));
  const tickets = current ? await loadRepairs(db, tenantId, current.roomId) : [];
  return (
    <>
      <LiveRefresh locale={locale} />
      <PageHeader
        locale={locale}
        title={p.title}
        description={p.intro}
        actions={
          <Link
            href={`/${locale}/t/repairs/new`}
            className={cn('inline-flex min-h-[44px] items-center rounded-sm bg-product-accent px-4 text-product-on-accent', focusRing)}
          >
            {p.new}
          </Link>
        }
      />
      {tickets.length === 0 ? (
        <p className="text-ink-muted">{p.none}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-semibold text-ink">{p.category[t.category as keyof typeof p.category] ?? t.category}</span>
                <span className="text-ink-muted">{p.status[t.status as keyof typeof p.status] ?? t.status}</span>
              </div>
              <p className="text-ink">{t.description}</p>
              <h3 className="text-ink-muted">{p.updates}</h3>
              {t.messages.length === 0 ? (
                <p className="text-ink-muted">{p.noUpdates}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {t.messages.map((msg) => (
                    <li key={msg.id} className="text-ink">
                      {msg.body}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
