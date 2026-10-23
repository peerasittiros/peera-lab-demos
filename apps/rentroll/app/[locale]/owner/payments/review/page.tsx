import { PageHeader } from '@/src/components/PageHeader';
import { AutoRefresh, ManualPaymentForm, ReviewCard } from '@/src/components/payments/PaymentForms';
import { loadPayableContracts, loadReviewQueue } from '@/src/db/queries/payments';
import { pageContext } from '@/src/server/page';
import { cn, ts } from '@peera/ui';

/** Owner payment review (01 §3.1 C.11, §8 screen 9): the slip queue, manual entry, live refresh every two seconds. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const [queue, contracts] = await Promise.all([loadReviewQueue(db, tenantId), loadPayableContracts(db, tenantId)]);
  const p = m.payments;
  return (
    <>
      <AutoRefresh everyMs={2000} />
      <PageHeader locale={locale} title={p.title} description={p.intro} />
      {queue.length === 0 ? (
        <p className="text-ink-muted">{p.empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {queue.map((item) => (
            <ReviewCard
              key={item.id}
              locale={locale}
              item={{
                id: item.id,
                amountSatang: item.amountSatang,
                paidAt: item.paidAt,
                roomNumber: item.roomNumber,
                renterName: item.renterName,
                owedSatang: item.owedSatang,
                open: item.open,
              }}
            />
          ))}
        </div>
      )}
      <section className="mt-10 flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-4 md:p-5">
        <h2 className={cn(ts('title', locale), 'text-ink')}>{p.manual.title}</h2>
        <ManualPaymentForm
          locale={locale}
          contracts={contracts.map((c) => ({
            contractId: c.contractId,
            label: `${c.roomNumber}${c.renterName ? ` · ${c.renterName}` : ''}`,
          }))}
        />
      </section>
    </>
  );
}
