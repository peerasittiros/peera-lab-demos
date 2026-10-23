import { PageHeader } from '@/src/components/PageHeader';
import { DepositsTable, ReportFrame } from '@/src/components/reports/ReportViews';
import { loadDepositsReport } from '@/src/db/queries/reports';
import { pageContext } from '@/src/server/page';

/** Deposit ledger: deposits held per contract and the refund for settled ones (01 §3.1 G.21). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const rows = await loadDepositsReport(db, tenantId);
  return (
    <>
      <PageHeader locale={locale} title={m.reports.deposits.title} />
      <ReportFrame locale={locale} report="deposits" period={null} title={m.reports.deposits.title} intro={m.reports.deposits.intro}>
        {rows.length === 0 ? <p className="text-ink-muted">{m.reports.empty}</p> : <DepositsTable locale={locale} rows={rows} />}
      </ReportFrame>
    </>
  );
}
