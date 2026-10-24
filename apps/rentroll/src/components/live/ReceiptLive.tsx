'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing } from '@peera/ui';
import Link from 'next/link';
import { useCallback } from 'react';
import type { StoreState } from '@/src/client-store/store';
import { useStore } from '@/src/client-store/hooks';
import { loadReceipt } from '@/src/client-store/selectors/live';
import { PageHeader } from '@/src/components/PageHeader';
import { PrintButton } from '@/src/components/billing/PrintButton';
import { translator } from '@/src/i18n';
import { ReadyGate } from './ReadyGate';

/** Bangkok date and time for a receipt. Thai uses the Buddhist year through Intl. */
function paidOn(at: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(at));
}

/** One approved payment as a printable receipt (SPEC §4 T4). */
export function ReceiptLive({
  locale,
  paymentId,
}: {
  locale: Locale;
  paymentId: string;
}) {
  return (
    <ReadyGate locale={locale}>
      <ReceiptBody locale={locale} paymentId={paymentId} />
    </ReadyGate>
  );
}

function ReceiptBody({
  locale,
  paymentId,
}: {
  locale: Locale;
  paymentId: string;
}) {
  const { m } = translator(locale);
  const p = m.tenant.receipt;
  const select = useCallback(
    (s: StoreState) =>
      s.snapshotDate ? loadReceipt(s.data, paymentId, s.snapshotDate) : null,
    [paymentId],
  );
  const found = useStore(select);
  if (!found)
    return <p className="text-ink-muted">{m.tenant.live.receiptNotFound}</p>;
  const { payment, paid } = found;

  return (
    <>
      <Link
        href={`/${locale}/t/bills`}
        className={cn(
          'no-print mb-4 inline-flex min-h-11 items-center text-ink underline-offset-4 hover:underline',
          focusRing,
        )}
      >
        {p.back}
      </Link>
      <PageHeader
        locale={locale}
        title={`${p.title} ${payment.receiptNumber}`}
      />
      <article className="flex max-w-[40rem] flex-col gap-4 rounded-sm border border-line bg-surface-raised p-6 text-ink print:border-0 print:bg-transparent print:p-0">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-ink-muted">{p.number}</dt>
          <dd className="tabular-nums">{payment.receiptNumber}</dd>
          <dt className="text-ink-muted">{p.paidOn}</dt>
          <dd>{paidOn(payment.paidAt, locale)}</dd>
          <dt className="text-ink-muted">{p.method}</dt>
          <dd>
            {p.methods[payment.method as keyof typeof p.methods] ??
              payment.method}
          </dd>
        </dl>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th scope="col" className="py-2 font-normal">
                {p.invoice}
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {p.amount}
              </th>
            </tr>
          </thead>
          <tbody>
            {paid.map((row) => (
              <tr key={row.invoiceNumber} className="border-b border-line">
                <td className="py-2 tabular-nums">{row.invoiceNumber}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(row.amountSatang, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xl font-semibold tabular-nums">
          <span className="text-base font-normal text-ink-muted">
            {p.total}{' '}
          </span>
          {formatMoney(payment.amountSatang, locale)}
        </p>
      </article>
      <div className="no-print mt-4">
        <PrintButton label={p.print} />
      </div>
    </>
  );
}
