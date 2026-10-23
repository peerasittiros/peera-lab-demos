import { DemoSplit } from '@peera/demo-kit';
import { LiveRefresh } from '@/src/components/tenant/TenantForms';
import { OwnerFeed, TenantHome } from '@/src/components/tenant/TenantViews';
import { loadOwnerFeed, loadTenantHome } from '@/src/db/queries/tenant';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';

/**
 * Tenant portal and owner side by side (01 §6.1). Both sides read this sandbox; the live feed on the tenant side
 * refreshes the page when either side changes something, so the owner's view moves with the tenant's actions.
 */
export default async function RentrollHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, db, tenantId, m } = await pageContext(params);
  const today = bangkokDate(new Date());
  const [home, feed] = await Promise.all([loadTenantHome(db, tenantId, today), loadOwnerFeed(db, tenantId)]);
  return (
    <>
      <LiveRefresh locale={locale} />
      <DemoSplit
        locale={locale}
        labels={{ customer: m.roles.tenant, shop: m.roles.owner }}
        customer={<TenantHome locale={locale} home={home} />}
        shop={<OwnerFeed locale={locale} slipsWaiting={feed.slipsWaiting} openRepairs={feed.openRepairs} events={feed.events} />}
      />
    </>
  );
}
