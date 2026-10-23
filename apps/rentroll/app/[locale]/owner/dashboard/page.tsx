import { PageHeader } from '@/src/components/PageHeader';
import { DashboardView } from '@/src/components/reports/ReportViews';
import { loadDashboard } from '@/src/db/queries/reports';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';

/** Owner dashboard (01 §3.1 F.18–19, §8 screen 1). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const today = bangkokDate(new Date());
  const data = await loadDashboard(db, tenantId, today.slice(0, 7), today);
  return (
    <>
      <PageHeader locale={locale} title={m.dashboard.title} description={m.dashboard.intro} />
      <DashboardView locale={locale} data={data} />
    </>
  );
}
