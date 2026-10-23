import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { cn, ts } from '@peera/ui';
import { translator } from '../../i18n';

export type DocumentLine = {
  id: string;
  labelTh: string;
  labelEn: string;
  amountSatang: number;
  meta: Record<string, unknown>;
};

export type DocumentData = {
  number: string;
  status: string;
  period: string | null;
  issueDate: string;
  dueDate: string;
  totalSatang: number;
  paidSatang: number;
  buildingNameTh: string;
  buildingNameEn: string | null;
  bankName: string | null;
  bankAccountMasked: string | null;
  roomNumber: string;
  renterName: string | null;
  lines: DocumentLine[];
};

/** Paper sizes: the page width and the print page size. Only these two values reach the stylesheet. */
const SIZE = {
  a4: { width: '210mm', page: 'A4' },
  a5: { width: '148mm', page: 'A5' },
} as const;

/** Thai dates use the Buddhist year (พ.ศ.) through Intl (CLAUDE.md, "Rules that are easy to break"). */
function dateText(iso: string, locale: Locale): string {
  const formatter = new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
  return formatter.format(new Date(`${iso}T12:00:00+07:00`));
}

/**
 * The invoice as a printable document (01 §6.3, §8 screen 5). Two languages can print together: Thai above English,
 * the second in smaller type. The QR is a sample string, never a payable code.
 */
export function InvoiceDocument({
  locale,
  bilingual,
  size,
  invoice,
}: {
  locale: Locale;
  bilingual: boolean;
  size: keyof typeof SIZE;
  invoice: DocumentData;
}) {
  const { m } = translator(locale);
  const p = m.billing.public;
  const paper = SIZE[size];
  const both = (th: string, en: string) =>
    bilingual ? (
      <>
        <span lang="th">{th}</span>
        <span lang="en" className="block text-[0.8em] text-ink-muted">
          {en}
        </span>
      </>
    ) : (
      <span lang={locale}>{locale === 'th' ? th : en}</span>
    );
  const amount = formatMoney(invoice.totalSatang, locale);
  const balance = invoice.totalSatang - invoice.paidSatang;
  // A5 is short: a denser layout keeps the invoice on one page.
  const dense = size === 'a5';

  return (
    <>
      <style>{`@page { size: ${paper.page}; margin: ${dense ? '10mm' : '12mm'}; } @media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
      <article
        className={cn('mx-auto flex flex-col bg-surface-raised text-ink shadow-sm print:shadow-none', dense ? 'gap-2 p-3' : 'gap-6 p-6')}
        style={{ width: `min(100%, ${paper.width})` }}
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div className="flex flex-col">
            <h1 className={cn(ts('headline-sm', locale), 'm-0')}>{both(invoice.buildingNameTh, invoice.buildingNameEn ?? invoice.buildingNameTh)}</h1>
            <span className="text-ink-muted">{p.title}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-right">
            <dt className="text-ink-muted">{p.number}</dt>
            <dd className="tabular-nums">{invoice.number}</dd>
            {invoice.period ? (
              <>
                <dt className="text-ink-muted">{p.period}</dt>
                <dd className="tabular-nums">{invoice.period}</dd>
              </>
            ) : null}
            <dt className="text-ink-muted">{p.issued}</dt>
            <dd>{dateText(invoice.issueDate, locale)}</dd>
            <dt className="text-ink-muted">{p.due}</dt>
            <dd>{dateText(invoice.dueDate, locale)}</dd>
          </dl>
        </header>

        <section className="grid gap-2 md:grid-cols-2 print:grid-cols-2">
          <p>
            <span className="text-ink-muted">{p.room} </span>
            <span className="tabular-nums">{invoice.roomNumber}</span>
          </p>
          <p>
            <span className="text-ink-muted">{p.renter} </span>
            <span>{invoice.renterName ?? '—'}</span>
          </p>
        </section>

        <table className={cn('w-full border-collapse text-left', dense && '[&_td]:py-1 [&_th]:py-1')}>
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th scope="col" className="py-2 font-normal">
                {p.item}
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {p.amount}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-b border-line">
                <td className="py-2">
                  {both(line.labelTh, line.labelEn)}
                  {line.meta.estimate === true ? <span className="text-ink-muted"> {m.billing.estimated}</span> : null}
                </td>
                <td className="py-2 text-right tabular-nums">{formatMoney(line.amountSatang, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="text-3xl font-semibold tabular-nums">
            <span className="text-base font-normal text-ink-muted">{p.total} </span>
            {amount}
          </p>
          {balance > 0 && balance !== invoice.totalSatang ? (
            <p className="tabular-nums text-ink-muted">
              <span>{p.balance} </span>
              {formatMoney(balance, locale)}
            </p>
          ) : null}
        </div>

        <section className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h2 className={cn(ts('title', locale), 'm-0')}>{p.paySection}</h2>
            {invoice.bankName || invoice.bankAccountMasked ? (
              <p>
                <span className="text-ink-muted">{p.bank} </span>
                <span>{[invoice.bankName, invoice.bankAccountMasked].filter(Boolean).join(' ')}</span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 rounded-sm border border-dashed border-line-strong p-3">
            <span className="font-semibold text-ink">{p.sampleQr}</span>
            <span className="rounded-sm bg-surface-sunken px-2 py-1 text-sm text-danger">{p.qrBanner}</span>
            <code className="break-all tabular-nums text-ink">{`RENTROLL-DEMO-${invoice.number}-${(invoice.totalSatang / 100).toFixed(2)}`}</code>
            <span className="text-sm text-ink-muted">{p.qrNote}</span>
          </div>
        </section>
      </article>
    </>
  );
}
