import { PageHeader } from '@/src/components/PageHeader';
import { SlipForm } from '@/src/components/payments/PaymentForms';
import { loadPayInvoice } from '@/src/db/queries/payments';
import { pageContext } from '@/src/server/page';
import { formatMoney } from '@peera/i18n';
import { cn, ts } from '@peera/ui';
import { notFound } from 'next/navigation';

/** Tenant pay screen (01 §3.1 D.13, §8 screen 7): what is owed, a sample QR, and the slip. */
export default async function Page({ params }: { params: Promise<{ locale: string; invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { locale, db, tenantId, m } = await pageContext(params);
  const found = await loadPayInvoice(db, tenantId, invoiceId);
  if (!found) notFound();
  const p = m.payments.pay;
  const i = found.invoice;
  const payable = i.status === 'sent' || i.status === 'partially_paid';
  const building = locale === 'th' ? found.buildingNameTh : (found.buildingNameEn ?? found.buildingNameTh);
  return (
    <>
      <PageHeader locale={locale} title={p.title} description={`${building} · ${found.roomNumber}`} />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          <p className="text-ink-muted">{p.owed}</p>
          <p className={cn(ts('headline-md', locale), 'tabular-nums text-ink')}>{formatMoney(found.outstandingSatang, locale)}</p>
          <p className="text-ink-muted">
            <span>{p.due}</span> <span className="tabular-nums">{i.dueDate}</span>
          </p>
          <p className="tabular-nums text-ink">{i.number}</p>
          <div className="flex flex-col gap-2 rounded-sm border border-dashed border-line-strong p-3">
            <span className="font-semibold text-ink">{p.sample}</span>
            <code className="break-all tabular-nums text-ink">{`RENTROLL-DEMO-${i.number}-${(found.outstandingSatang / 100).toFixed(2)}`}</code>
          </div>
        </section>
        <section className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          {found.pendingSlips > 0 ? <p className="text-ink">{p.waiting}</p> : null}
          {payable && found.outstandingSatang > 0 ? (
            <SlipForm locale={locale} invoiceId={i.id} outstandingSatang={found.outstandingSatang} />
          ) : (
            <p className="text-ink">{p.paid}</p>
          )}
        </section>
      </div>
    </>
  );
}
