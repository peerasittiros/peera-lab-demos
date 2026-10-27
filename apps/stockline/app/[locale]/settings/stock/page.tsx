import { StockRules } from '@/src/components/settings/StockRules';
import { pageContext } from '@/src/server/page';

export default async function SettingsStockPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <StockRules locale={locale} />;
}
