import { PageHeader } from '@/src/components/PageHeader';
import { RepairForm } from '@/src/components/tenant/TenantForms';
import { pageContext } from '@/src/server/page';

/** Report a repair (01 §3.1 D.15, §8 screen 8). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, m } = await pageContext(params);
  return (
    <>
      <PageHeader locale={locale} title={m.tenant.repairNew.title} />
      <RepairForm locale={locale} />
    </>
  );
}
