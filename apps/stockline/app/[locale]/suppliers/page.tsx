import { redirect } from 'next/navigation';
import { pageContext, type SearchParams } from '@/src/server/page';

// Suppliers moved under Settings; the old address redirects there and keeps the query (?sid inside the iframe).
export default async function SuppliersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await pageContext(params);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const entry of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      query.append(key, entry);
  const search = query.toString();
  redirect(`/${locale}/settings/suppliers${search ? `?${search}` : ''}`);
}
