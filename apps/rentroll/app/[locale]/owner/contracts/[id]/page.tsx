import { PageHeader } from '@/src/components/PageHeader';
import { GiveNoticeButton } from '@/src/components/contracts/ContractForms';
import { loadContractDetail } from '@/src/db/queries/contracts';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const { locale, db, tenantId, m } = await pageContext(params);
  const today = bangkokDate(new Date());
  const detail = await loadContractDetail(db, tenantId, id, today);
  if (!detail) notFound();
  const c = detail.contract;
  const p = m.contracts.detail;
  const building = locale === 'th' ? detail.buildingNameTh : (detail.buildingNameEn ?? detail.buildingNameTh);
  const linkClass = cn('inline-flex min-h-[44px] items-center text-ink underline-offset-4 hover:underline', focusRing);
  const checklistLabel = (status: string | null) =>
    status === 'ok' ? m.contracts.checklist.ok : status === 'damaged' ? m.contracts.checklist.damaged : m.contracts.checklist.none;

  return (
    <>
      <Link href={`/${locale}/owner/contracts`} className={cn(linkClass, 'mb-4')}>
        {m.contracts.title}
      </Link>
      <PageHeader
        locale={locale}
        title={`${p.title} ${detail.roomNumber}`}
        description={`${building} · ${m.contracts.status[c.status as keyof typeof m.contracts.status] ?? c.status}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {c.status === 'active' ? <GiveNoticeButton locale={locale} contractId={c.id} today={today} /> : null}
            {c.status !== 'ended' ? (
              <Link
                href={`/${locale}/owner/move-out/${c.id}`}
                className={cn('inline-flex min-h-[44px] items-center rounded-sm border border-line bg-surface-raised px-4 text-ink', focusRing)}
              >
                {p.moveOut}
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          <h2 className={cn(ts('title', locale), 'mb-3 text-ink')}>{p.terms}</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-ink">
            <dt className="text-ink-muted">{p.rent}</dt>
            <dd>{formatMoney(c.monthlyRentSatang, locale)}</dd>
            <dt className="text-ink-muted">{p.deposit}</dt>
            <dd>{formatMoney(c.depositSatang, locale)}</dd>
            <dt className="text-ink-muted">{p.depositReceived}</dt>
            <dd>{formatMoney(c.depositReceivedSatang, locale)}</dd>
            <dt className="text-ink-muted">{p.advance}</dt>
            <dd>{c.advanceMonths}</dd>
            <dt className="text-ink-muted">{p.occupants}</dt>
            <dd>{c.occupants}</dd>
            <dt className="text-ink-muted">{p.start}</dt>
            <dd className="tabular-nums">{c.startDate}</dd>
            <dt className="text-ink-muted">{p.end}</dt>
            <dd className="tabular-nums">{c.endDate ?? m.contracts.blank}</dd>
            {c.noticeDate ? (
              <>
                <dt className="text-ink-muted">{p.notice}</dt>
                <dd className="tabular-nums">{c.noticeDate}</dd>
              </>
            ) : null}
          </dl>
        </section>

        <section className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          <h2 className={cn(ts('title', locale), 'mb-3 text-ink')}>{p.renters}</h2>
          <ul className="flex flex-col gap-1 text-ink">
            {detail.renters.map((r) => (
              <li key={r.id}>
                {r.name} {r.isPrimary ? <span className="text-ink-muted">{p.primary}</span> : null}{' '}
                <span className="tabular-nums text-ink-muted">{r.phone ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-sm border border-line bg-surface-raised p-4 md:col-span-2 md:p-5">
          <h2 className={cn(ts('title', locale), 'mb-3 text-ink')}>{p.invoices}</h2>
          {detail.invoices.length === 0 ? (
            <p className="text-ink-muted">{p.noInvoices}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-ink">
              {detail.invoices.map((i) => (
                <li key={i.id} className="grid gap-x-6 md:grid-cols-4">
                  <span className="tabular-nums">{i.number}</span>
                  <span className="text-ink-muted">{i.type}</span>
                  <span className="tabular-nums text-ink-muted">{i.dueDate}</span>
                  <span className="tabular-nums">{formatMoney(i.totalSatang, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          <h2 className={cn(ts('title', locale), 'mb-3 text-ink')}>{p.checklists}</h2>
          {detail.checklists.length === 0 ? (
            <p className="text-ink-muted">{p.noSettlement}</p>
          ) : (
            detail.checklists.map((list) => (
              <div key={list.kind} className="mb-4">
                <h3 className="mb-1 text-ink-muted">{list.kind === 'move_in' ? m.contracts.moveIn.checklist : m.contracts.moveOut.checklist}</h3>
                <ul className="flex flex-col gap-1 text-ink">
                  {list.items.map((item) => (
                    <li key={item.key} className="flex justify-between gap-4">
                      <span>{locale === 'th' ? item.labelTh : item.labelEn}</span>
                      <span>{checklistLabel(item.status)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <section className="rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          <h2 className={cn(ts('title', locale), 'mb-3 text-ink')}>{p.settlement}</h2>
          {detail.settlement ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-ink">
              <dt className="text-ink-muted">{m.contracts.moveOut.deposit}</dt>
              <dd>{formatMoney(detail.settlement.depositSatang, locale)}</dd>
              {detail.settlement.deductions.map((d) => (
                <div key={d.key} className="contents">
                  <dt className="text-ink-muted">{locale === 'th' ? d.labelTh : d.labelEn}</dt>
                  <dd>{formatMoney(d.amountSatang, locale)}</dd>
                </div>
              ))}
              <dt className="text-ink-muted">{detail.settlement.refundSatang < 0 ? m.contracts.moveOut.owed : m.contracts.moveOut.refund}</dt>
              <dd>{formatMoney(Math.abs(detail.settlement.refundSatang), locale)}</dd>
            </dl>
          ) : (
            <p className="text-ink-muted">{p.noSettlement}</p>
          )}
        </section>
      </div>
    </>
  );
}
