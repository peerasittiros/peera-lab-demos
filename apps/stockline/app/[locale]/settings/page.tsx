import { OwnerOnly } from '@/src/components/OwnerOnly';
import { SettingsView } from '@/src/components/SettingsView';
import { pageContext } from '@/src/server/page';

// Settings, categories and units live in the browser store. Staff are sent to their landing page.
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return (
    <OwnerOnly locale={locale}>
      <SettingsView locale={locale} />
    </OwnerOnly>
  );
}
