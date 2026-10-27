import { OrdersView } from '@/src/components/OrdersView';
import { pageContext } from '@/src/server/page';

// Purchase orders live in the browser store, so the page renders the client list.
export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <OrdersView locale={locale} />;
}
