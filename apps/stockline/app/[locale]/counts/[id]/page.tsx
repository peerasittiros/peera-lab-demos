import { CountView } from '@/src/components/CountView';
import { pageContext } from '@/src/server/page';

// The count comes from the browser store; the page passes the id on.
export default async function CountPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const { locale } = await pageContext(params);
  return <CountView id={id} locale={locale} />;
}
