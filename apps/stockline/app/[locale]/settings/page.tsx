import { SettingsIndex } from '@/src/components/settings/SettingsIndex';
import { pageContext } from '@/src/server/page';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <SettingsIndex locale={locale} />;
}
