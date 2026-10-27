import { OrderView } from '@/src/components/OrderView';
import { pageContext } from '@/src/server/page';

// The order comes from the browser store; the page passes the id on.
export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const { locale } = await pageContext(params);
  return <OrderView id={id} locale={locale} />;
}
