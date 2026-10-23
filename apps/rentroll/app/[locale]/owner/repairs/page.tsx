import { PageHeader } from '@/src/components/PageHeader';
import { RepairBoard } from '@/src/components/repairs/RepairBoard';
import { LiveRefresh } from '@/src/components/tenant/TenantForms';
import { loadRepairBoard } from '@/src/db/queries/repairs';
import { pageContext } from '@/src/server/page';

/** Owner's repair board (01 §3.1 E.17, §8 screen 11). The tenant side refreshes live as the board changes. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const tickets = await loadRepairBoard(db, tenantId);
  return (
    <>
      <LiveRefresh locale={locale} />
      <PageHeader locale={locale} title={m.ownerRepairs.title} description={m.ownerRepairs.intro} />
      <RepairBoard locale={locale} tickets={tickets} now={new Date().toISOString()} />
    </>
  );
}
