import { ShopSettings } from '@/src/components/settings/ShopSettings';
import { pageContext } from '@/src/server/page';

export default async function SettingsShopPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <ShopSettings locale={locale} />;
}
