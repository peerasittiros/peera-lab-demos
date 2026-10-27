import { CountsView } from '@/src/components/CountsView';
import { pageContext } from '@/src/server/page';

// Counts live in the browser store, so the page renders the client list.
export default async function CountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <CountsView locale={locale} />;
}
