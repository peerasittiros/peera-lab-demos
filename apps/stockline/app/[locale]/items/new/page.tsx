import { ItemNew } from '@/src/components/ItemNew';
import { OwnerOnly } from '@/src/components/OwnerOnly';
import { PageHeader } from '@/src/components/PageHeader';
import { pageContext, type SearchParams } from '@/src/server/page';

export default async function NewItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale, m } = await pageContext(params);
  const query = await searchParams;
  const barcode = typeof query.barcode === 'string' ? query.barcode : (query.barcode?.[0] ?? '');
  return (
    <OwnerOnly locale={locale}>
      <PageHeader locale={locale} title={m.items.newTitle} description={m.items.newSubtitle} />
      <ItemNew locale={locale} barcode={barcode.trim().slice(0, 64)} />
    </OwnerOnly>
  );
}
