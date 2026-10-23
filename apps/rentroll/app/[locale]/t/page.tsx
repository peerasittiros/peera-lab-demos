import { PageHeader } from '@/src/components/PageHeader';
import { LiveRefresh } from '@/src/components/tenant/TenantForms';
import { TenantHome } from '@/src/components/tenant/TenantViews';
import { loadTenantHome } from '@/src/db/queries/tenant';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';

/** Tenant home (01 §3.1 D.13, §8 screen 6). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const home = await loadTenantHome(db, tenantId, bangkokDate(new Date()));
  return (
    <>
      <LiveRefresh locale={locale} />
      <PageHeader locale={locale} title={m.placeholder.tenantHome} />
      <TenantHome locale={locale} home={home} />
    </>
  );
}
