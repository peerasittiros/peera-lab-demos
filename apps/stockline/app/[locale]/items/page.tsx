import { ItemsView } from '@/src/components/ItemsView';
import { pageContext } from '@/src/server/page';

// The items come from the browser store. Filters live in the URL.
export default async function ItemsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <ItemsView locale={locale} />;
}
