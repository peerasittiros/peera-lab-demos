'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing } from '@peera/ui';
import Link from 'next/link';
import { useCallback } from 'react';
import { useStore } from '@/src/client-store/hooks';
import { tenantBill } from '@/src/client-store/selectors/billing';
import { visitorInvoiceIds } from '@/src/client-store/selectors/billing';
import type { StoreState } from '@/src/client-store/store';
import { PageHeader } from '@/src/components/PageHeader';
import { translator } from '@/src/i18n';
import { ReadyGate } from './ReadyGate';
import { publicLinkFor } from './public-link';

/** One bill of the tenant: its lines, its receipts, and the printable invoice (SPEC §4 T2). */
export function BillDetailLive({
  locale,
  invoiceId,
}: {
  locale: Locale;
  invoiceId: string;
}) {
  return (
    <ReadyGate locale={locale}>
      <BillDetailBody locale={locale} invoiceId={invoiceId} />
    </ReadyGate>
  );
}

function BillDetailBody({
  locale,
  invoiceId,
}: {
  locale: Locale;
  invoiceId: string;
}) {
  const { m } = translator(locale);
  const p = m.tenant.billDetail;
  const select = useCallback(
    (s: StoreState) =>
      s.snapshotDate ? tenantBill(s.data, invoiceId, s.snapshotDate) : null,
    [invoiceId],
  );
  const bill = useStore(select);
  const visitor = useStore(
    useCallback(
      (s: StoreState) => visitorInvoiceIds(s.ops).has(invoiceId),
      [invoiceId],
    ),
  );
  if (!bill) return <p className="text-ink-muted">{p.notFound}</p>;
  const { invoice } = bill;

  const openPublic = async () => {
    const url = await publicLinkFor(
      bill.data,
      invoice.id,
      invoice.publicToken,
      visitor,
      locale,
    );
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <>
      <Link
        href={`/${locale}/t/bills`}
        className={cn(
          'mb-4 inline-flex min-h-11 items-center text-ink underline-offset-4 hover:underline',
          focusRing,
        )}
      >
        {p.back}
      </Link>
      <PageHeader locale={locale} title={`${p.title} ${invoice.number}`} />
      <ul className="flex flex-col gap-2">
        {bill.lines.map((line) => (
          <li
            key={line.id}
            className="flex justify-between gap-4 rounded-sm border border-line bg-surface-raised p-3 text-ink"
          >
            <span>
              {locale === 'th' ? line.labelTh : line.labelEn}
              {line.meta.estimate === true ? (
                <span className="text-ink-muted"> {p.estimated}</span>
              ) : null}
            </span>
            <span className="tabular-nums">
              {formatMoney(line.amountSatang, locale)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-ink">
        <span className="text-ink-muted">{m.payments.pay.owed} </span>
        <span className="tabular-nums">
          {formatMoney(invoice.totalSatang, locale)}
        </span>
      </p>
      {bill.receipts.length > 0 ? (
        <section className="mt-6 flex flex-col gap-2">
          <h2 className="m-0 text-ink">{p.receipts}</h2>
          <ul className="flex flex-col gap-2">
            {bill.receipts.map((r) => (
              <li key={r.paymentId}>
                <Link
                  href={`/${locale}/t/receipts/${r.paymentId}`}
                  className={cn(
                    'inline-flex min-h-11 flex-wrap items-center gap-x-3 text-ink underline-offset-4 hover:underline',
                    focusRing,
                  )}
                >
                  <span className="tabular-nums">{r.receiptNumber}</span>
                  <span className="tabular-nums">
                    {formatMoney(r.amountSatang, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => void openPublic()}
        className={cn(
          'mt-4 inline-flex min-h-11 items-center text-ink underline-offset-4 hover:underline',
          focusRing,
        )}
      >
        {m.billing.public.title}
      </button>
    </>
  );
}
