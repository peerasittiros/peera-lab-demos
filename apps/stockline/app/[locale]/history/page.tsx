import { HistoryView } from '@/src/components/HistoryView';
import { pageContext } from '@/src/server/page';

// The history is read from the browser store. Filters live in the URL.
export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <HistoryView locale={locale} />;
}
