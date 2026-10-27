import { ImportWizard } from '@/src/components/ImportWizard';
import { OwnerOnly } from '@/src/components/OwnerOnly';
import { PageHeader } from '@/src/components/PageHeader';
import { pageContext } from '@/src/server/page';

export default async function ImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, m } = await pageContext(params);
  return (
    <OwnerOnly locale={locale}>
      <PageHeader locale={locale} title={m.import.title} description={m.import.subtitle} />
      <ImportWizard locale={locale} />
    </OwnerOnly>
  );
}
