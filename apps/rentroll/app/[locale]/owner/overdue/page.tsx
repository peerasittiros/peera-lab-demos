import { PageHeader } from '@/src/components/PageHeader';
import { ReminderButton } from '@/src/components/payments/PaymentForms';
import { loadOverdue } from '@/src/db/queries/payments';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';
import { formatMoney } from '@peera/i18n';
import { cn, ts } from '@peera/ui';

/** Overdue list (01 §3.1 C.12, §8 screen 1 "To do"): days overdue, late fee so far, reminders sent. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const now = new Date();
  const rows = await loadOverdue(db, tenantId, bangkokDate(now), now);
  const p = m.payments.overdue;
  return (
    <>
      <PageHeader locale={locale} title={p.title} description={p.intro} />
      {rows.length === 0 ? (
        <p className="text-ink-muted">{p.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.invoiceId} className="grid gap-3 rounded-sm border border-line bg-surface-raised p-4 md:grid-cols-5">
              <span className={cn(ts('title', locale), 'tabular-nums text-ink')}>{row.roomNumber}</span>
              <span className="text-ink-muted">
                <span>{p.outstanding}</span> <span className="tabular-nums text-ink">{formatMoney(row.outstandingSatang, locale)}</span>
              </span>
              <span className="text-ink-muted">
                <span>{p.days}</span> <span className="tabular-nums text-danger">{row.daysOverdue}</span>
              </span>
              <span className="text-ink-muted">
                <span>{p.lateFee}</span> <span className="tabular-nums text-ink">{formatMoney(row.lateFeeSatang, locale)}</span>
              </span>
              <div className="flex flex-col gap-2">
                <ReminderButton locale={locale} invoiceId={row.invoiceId} />
                <span className="text-ink-muted">{p.history}</span>
                {row.reminders.length === 0 ? (
                  <span className="text-ink-muted">{p.none}</span>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {row.reminders.map((r) => (
                      <li key={r.date} className="tabular-nums text-ink">
                        {r.date}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
