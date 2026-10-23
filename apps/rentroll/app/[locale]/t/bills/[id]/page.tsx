import { PageHeader } from '@/src/components/PageHeader';
import { loadInvoiceReceipts, loadTenantInvoice, tenantContract } from '@/src/db/queries/tenant';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
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
  const receipts = await loadInvoiceReceipts(db, tenantId, found.invoice.id);
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
      {receipts.length > 0 ? (
        <section className="mt-6 flex flex-col gap-2">
          <h2 className={cn(ts('title', locale), 'm-0')}>{p.receipts}</h2>
          <ul className="flex flex-col gap-2">
            {receipts.map((r) => (
              <li key={r.paymentId}>
                <Link href={`/${locale}/t/receipts/${r.paymentId}`} className={cn('inline-flex min-h-[44px] flex-wrap items-center gap-x-3 text-ink underline-offset-4 hover:underline', focusRing)}>
                  <span className="tabular-nums">{r.receiptNumber}</span>
                  <span className="tabular-nums">{formatMoney(r.amountSatang, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Link
        href={`/i/${found.invoice.publicToken}?lang=${locale}`}
        className={cn('mt-4 inline-flex min-h-[44px] items-center text-ink underline-offset-4 hover:underline', focusRing)}
      >
        {m.billing.public.title}
      </Link>
    </>
  );
}
