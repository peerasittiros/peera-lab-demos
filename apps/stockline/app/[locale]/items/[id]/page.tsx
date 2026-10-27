import { ItemDetail } from '@/src/components/ItemDetail';
import { pageContext } from '@/src/server/page';

// The item comes from the browser store; the page passes the id on.
export default async function ItemPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const { locale } = await pageContext(params);
  return <ItemDetail id={id} locale={locale} />;
}
