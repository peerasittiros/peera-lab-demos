import { SuppliersView } from '@/src/components/SuppliersView';
import { pageContext } from '@/src/server/page';

export default async function SettingsSuppliersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <SuppliersView locale={locale} />;
}
