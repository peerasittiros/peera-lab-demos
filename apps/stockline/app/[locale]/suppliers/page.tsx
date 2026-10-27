import { OwnerOnly } from '@/src/components/OwnerOnly';
import { SuppliersView } from '@/src/components/SuppliersView';
import { pageContext } from '@/src/server/page';

// Suppliers live in the browser store. Staff are sent to their landing page.
export default async function SuppliersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return (
    <OwnerOnly locale={locale}>
      <SuppliersView locale={locale} />
    </OwnerOnly>
  );
}
