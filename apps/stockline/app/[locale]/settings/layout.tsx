import type { ReactNode } from 'react';
import { OwnerOnly } from '@/src/components/OwnerOnly';
import { SettingsFrame } from '@/src/components/settings/SettingsFrame';
import { pageContext } from '@/src/server/page';

// Every settings page is owner only and sits in the same frame: the groups beside the page from 768 px, a back link
// to the list on phones. The pages read and write the browser store.
export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageContext(params);
  return (
    <OwnerOnly locale={locale}>
      <SettingsFrame locale={locale}>{children}</SettingsFrame>
    </OwnerOnly>
  );
}
