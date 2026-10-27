import { DataSettings } from '@/src/components/settings/DataSettings';
import { pageContext } from '@/src/server/page';

export default async function SettingsDataPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <DataSettings locale={locale} />;
}
