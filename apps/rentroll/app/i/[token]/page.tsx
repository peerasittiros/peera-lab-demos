import { InvoiceDocument } from '@/src/components/billing/InvoiceDocument';
import { PrintButton } from '@/src/components/billing/PrintButton';
import { loadSnapshotDocument } from '@/src/db/snapshot-document';
import { bangkokDate } from '@/src/domain/dates';
import { translator } from '@/src/i18n';
import { isLocale } from '@peera/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn, focusRing } from '@peera/ui';

// The signed invoice link (01 §6.1). It needs no session and is kept out of search results. Drafts are never shown.
// The invoice comes from the day's snapshot of the template (SPEC §5), so no visitor data is read here.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PublicInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const lang = String(query.lang ?? 'th');
  const locale = isLocale(lang) ? lang : 'th';
  const size = query.size === 'a5' ? 'a5' : 'a4';
  const bilingual = query.bilingual === '1';
  const { m } = translator(locale);

  const { snapshot } = await loadSnapshotDocument(bangkokDate(new Date()));
  const invoice = snapshot.tables.invoice?.find(
    (i) => i.publicToken === token && i.status !== 'draft',
  );
  if (!invoice) notFound();
  const building = snapshot.tables.building?.find(
    (b) => b.id === invoice.buildingId,
  );
  const contract = snapshot.tables.contract?.find(
    (c) => c.id === invoice.contractId,
  );
  const room = snapshot.tables.room?.find((r) => r.id === contract?.roomId);
  const primary = snapshot.tables.contract_renter?.find(
    (cr) => cr.contractId === contract?.id && cr.isPrimary,
  );
  const renter = snapshot.tables.renter?.find(
    (r) => r.id === primary?.renterId,
  );
  const lines = (snapshot.tables.invoice_line ?? []).filter(
    (l) => l.invoiceId === invoice.id,
  );
  if (!building) notFound();

  const link = (params: Record<string, string>) => {
    const qs = new URLSearchParams({
      lang: locale,
      size,
      ...(bilingual ? { bilingual: '1' } : {}),
      ...params,
    });
    return `/i/${token}?${qs.toString()}`;
  };
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-[44px] items-center rounded-sm border px-3 text-ink',
      active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
      focusRing,
    );

  return (
    <main className="mx-auto flex max-w-[60rem] flex-col gap-4 px-4 py-6 print:p-0">
      <nav
        aria-label={m.billing.public.size}
        className="no-print flex flex-wrap items-center gap-2"
      >
        <Link
          href={link({ size: 'a4' })}
          aria-current={size === 'a4' ? 'page' : undefined}
          className={chip(size === 'a4')}
        >
          {m.billing.public.a4}
        </Link>
        <Link
          href={link({ size: 'a5' })}
          aria-current={size === 'a5' ? 'page' : undefined}
          className={chip(size === 'a5')}
        >
          {m.billing.public.a5}
        </Link>
        <Link
          href={link({ bilingual: bilingual ? '0' : '1' })}
          aria-current={bilingual ? 'page' : undefined}
          className={chip(bilingual)}
        >
          {m.billing.public.bilingual}
        </Link>
        <PrintButton label={m.billing.public.print} />
      </nav>
      <InvoiceDocument
        locale={locale}
        bilingual={bilingual}
        size={size}
        invoice={{
          number: invoice.number,
          status: invoice.status,
          period: invoice.period,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          totalSatang: invoice.totalSatang,
          paidSatang: invoice.paidSatang,
          buildingNameTh: building.nameTh,
          buildingNameEn: building.nameEn,
          bankName: building.bankName,
          bankAccountMasked: building.bankAccountMasked,
          roomNumber: room?.number ?? '',
          renterName: renter?.name ?? null,
          lines: lines.map((l) => ({
            id: l.id,
            labelTh: l.labelTh,
            labelEn: l.labelEn,
            amountSatang: l.amountSatang,
            meta: l.meta,
          })),
        }}
      />
    </main>
  );
}
