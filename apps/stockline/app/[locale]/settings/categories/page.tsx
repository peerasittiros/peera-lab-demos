import { CategoriesSettings } from '@/src/components/settings/OrderedList';
import { pageContext } from '@/src/server/page';

export default async function SettingsCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <CategoriesSettings locale={locale} />;
}
