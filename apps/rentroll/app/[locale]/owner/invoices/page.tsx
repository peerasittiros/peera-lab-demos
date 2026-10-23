import { RoutePlaceholder } from '@/src/components/RoutePlaceholder';
import { pageContext } from '@/src/server/page';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, m } = await pageContext(params);
  return (
    <RoutePlaceholder
      locale={locale}
      title={m.placeholder.invoices}
      description={m.common.comingSoon}
    />
  );
}
