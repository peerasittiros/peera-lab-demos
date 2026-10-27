import { UsersSettings } from '@/src/components/settings/UsersSettings';
import { pageContext } from '@/src/server/page';

export default async function SettingsUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return <UsersSettings locale={locale} />;
}
