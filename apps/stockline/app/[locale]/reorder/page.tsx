import { ReorderView } from '@/src/components/ReorderView';
import { pageContext } from '@/src/server/page';

// The reorder list is built from the browser store (the same rule as src/domain/reorder.ts).
export default async function ReorderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <ReorderView locale={locale} />;
}
