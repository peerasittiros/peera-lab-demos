import { DashboardView } from '@/src/components/DashboardView';
import { OwnerOnly } from '@/src/components/OwnerOnly';
import { pageContext } from '@/src/server/page';

// The owner dashboard is computed from the browser store. Staff are sent to their landing page.
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return (
    <OwnerOnly locale={locale}>
      <DashboardView locale={locale} />
    </OwnerOnly>
  );
}
