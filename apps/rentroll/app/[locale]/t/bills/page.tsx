import { PageHeader } from '@/src/components/PageHeader';
import { LiveRefresh } from '@/src/components/tenant/TenantForms';
import { BillsView } from '@/src/components/tenant/TenantViews';
import { loadBills, tenantContract } from '@/src/db/queries/tenant';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';

/** The tenant's bills for twelve months, with usage (01 §3.1 D.14). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const current = await tenantContract(db, tenantId, bangkokDate(new Date()));
  const data = current ? await loadBills(db, tenantId, current.contractId, current.roomId) : { bills: [], usage: [] };
  return (
    <>
      <LiveRefresh locale={locale} />
      <PageHeader locale={locale} title={m.tenant.bills.title} />
      <BillsView locale={locale} bills={data.bills} usage={data.usage} />
    </>
  );
}
