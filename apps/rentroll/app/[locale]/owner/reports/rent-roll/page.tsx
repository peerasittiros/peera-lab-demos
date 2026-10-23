import { PageHeader } from '@/src/components/PageHeader';
import { ReportFrame, RentRollTable } from '@/src/components/reports/ReportViews';
import { loadRentRoll } from '@/src/db/queries/reports';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext, param, type SearchParams } from '@/src/server/page';

/** Monthly rent roll (01 §3.1 G.21, §8 screen 12). Print-friendly and exportable as CSV. */
export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const today = bangkokDate(new Date());
  const query = await searchParams;
  const requested = param(query.p);
  const period = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : today.slice(0, 7);
  const rows = await loadRentRoll(db, tenantId, period, today);
  return (
    <>
      <PageHeader locale={locale} title={m.reports.rentRoll.title} />
      <ReportFrame locale={locale} report="rent-roll" period={period} title={m.reports.rentRoll.title} intro={m.reports.rentRoll.intro}>
        {rows.length === 0 ? <p className="text-ink-muted">{m.reports.empty}</p> : <RentRollTable locale={locale} rows={rows} />}
      </ReportFrame>
    </>
  );
}
