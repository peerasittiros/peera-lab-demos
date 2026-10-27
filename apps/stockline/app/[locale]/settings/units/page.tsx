import { UnitsSettings } from '@/src/components/settings/OrderedList';
import { pageContext } from '@/src/server/page';

export default async function SettingsUnitsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <UnitsSettings locale={locale} />;
}
