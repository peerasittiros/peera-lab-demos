import { PageHeader } from '@/src/components/PageHeader';
import { QuickMove } from '@/src/components/QuickMove';
import { pageContext } from '@/src/server/page';

// The quick move reads the browser store; the role is chosen in the browser too.
export default async function QuickMovePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, m } = await pageContext(params);
  return (
    <>
      <PageHeader
        locale={locale}
        title={m.quickMove.title}
        description={m.quickMove.subtitle}
      />
      <QuickMove locale={locale} />
    </>
  );
}
