import { PageHeader } from '@/src/components/PageHeader';
import { loadTenantInvoice, tenantContract } from '@/src/db/queries/tenant';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing } from '@peera/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/** One bill: its lines, and a link to the printable invoice. */
export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const { locale, db, tenantId, m } = await pageContext(params);
  const current = await tenantContract(db, tenantId, bangkokDate(new Date()));
  if (!current) notFound();
  const found = await loadTenantInvoice(db, tenantId, current.contractId, id);
  if (!found) notFound();
  const p = m.tenant.billDetail;
  return (
    <>
      <Link href={`/${locale}/t/bills`} className={cn('mb-4 inline-flex min-h-[44px] items-center text-ink underline-offset-4 hover:underline', focusRing)}>
        {p.back}
      </Link>
      <PageHeader locale={locale} title={`${p.title} ${found.invoice.number}`} />
      <ul className="flex flex-col gap-2">
        {found.lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-4 rounded-sm border border-line bg-surface-raised p-3 text-ink">
            <span>
              {locale === 'th' ? line.labelTh : line.labelEn}
              {line.meta.estimate === true ? <span className="text-ink-muted"> {p.estimated}</span> : null}
            </span>
            <span className="tabular-nums">{formatMoney(line.amountSatang, locale)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-ink">
        <span className="text-ink-muted">{m.payments.pay.owed} </span>
        <span className="tabular-nums">{formatMoney(found.invoice.totalSatang, locale)}</span>
      </p>
      <Link
        href={`/i/${found.invoice.publicToken}?lang=${locale}`}
        className={cn('mt-4 inline-flex min-h-[44px] items-center text-ink underline-offset-4 hover:underline', focusRing)}
      >
        {m.billing.public.title}
      </Link>
    </>
  );
}
