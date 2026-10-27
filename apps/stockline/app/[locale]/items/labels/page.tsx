import { LabelsView } from '@/src/components/LabelsView';
import { pageContext } from '@/src/server/page';

// The labels come from the browser store (the same barcodes as the items).
export default async function LabelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <LabelsView locale={locale} />;
}
