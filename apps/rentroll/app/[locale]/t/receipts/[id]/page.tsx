import { PageHeader } from '@/src/components/PageHeader';
import { PrintButton } from '@/src/components/billing/PrintButton';
import { loadReceipt, tenantContract } from '@/src/db/queries/tenant';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing } from '@peera/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/** Bangkok date and time for a receipt. Thai uses the Buddhist year through Intl. */
function paidOn(at: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(at);
}

/** One approved payment as a printable receipt (01 §4). Only approved payments on the tenant's contract open. */
export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const { locale, db, tenantId, m } = await pageContext(params);
  const current = await tenantContract(db, tenantId, bangkokDate(new Date()));
  if (!current) notFound();
  const found = await loadReceipt(db, tenantId, current.contractId, id);
  if (!found) notFound();
  const p = m.tenant.receipt;
  const { payment, paid } = found;
  return (
    <>
      <Link href={`/${locale}/t/bills`} className={cn('no-print mb-4 inline-flex min-h-[44px] items-center text-ink underline-offset-4 hover:underline', focusRing)}>
        {p.back}
      </Link>
      <PageHeader locale={locale} title={`${p.title} ${payment.receiptNumber}`} />
      <article className="flex max-w-[40rem] flex-col gap-4 rounded-sm border border-line bg-surface-raised p-6 text-ink print:border-0 print:bg-transparent print:p-0">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-ink-muted">{p.number}</dt>
          <dd className="tabular-nums">{payment.receiptNumber}</dd>
          <dt className="text-ink-muted">{p.paidOn}</dt>
          <dd>{paidOn(payment.paidAt, locale)}</dd>
          <dt className="text-ink-muted">{p.method}</dt>
          <dd>{p.methods[payment.method as keyof typeof p.methods] ?? payment.method}</dd>
        </dl>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th scope="col" className="py-2 font-normal">{p.invoice}</th>
              <th scope="col" className="py-2 text-right font-normal">{p.amount}</th>
            </tr>
          </thead>
          <tbody>
            {paid.map((row) => (
              <tr key={row.invoiceNumber} className="border-b border-line">
                <td className="py-2 tabular-nums">{row.invoiceNumber}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(row.amountSatang, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xl font-semibold tabular-nums">
          <span className="text-base font-normal text-ink-muted">{p.total} </span>
          {formatMoney(payment.amountSatang, locale)}
        </p>
      </article>
      <div className="no-print mt-4">
        <PrintButton label={p.print} />
      </div>
    </>
  );
}
