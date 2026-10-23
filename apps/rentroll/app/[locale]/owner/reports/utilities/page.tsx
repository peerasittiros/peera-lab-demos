import { PageHeader } from '@/src/components/PageHeader';
import { ReportFrame, UtilitiesTable } from '@/src/components/reports/ReportViews';
import { loadUtilitiesReport } from '@/src/db/queries/reports';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext, param, type SearchParams } from '@/src/server/page';

/** Utilities report: units and amounts per room for the month (01 §3.1 G.21). */
export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const today = bangkokDate(new Date());
  const query = await searchParams;
  const requested = param(query.p);
  const period = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : today.slice(0, 7);
  const rows = await loadUtilitiesReport(db, tenantId, period);
  return (
    <>
      <PageHeader locale={locale} title={m.reports.utilities.title} />
      <ReportFrame locale={locale} report="utilities" period={period} title={m.reports.utilities.title} intro={m.reports.utilities.intro}>
        {rows.length === 0 ? <p className="text-ink-muted">{m.reports.empty}</p> : <UtilitiesTable locale={locale} rows={rows} />}
      </ReportFrame>
    </>
  );
}
