import { isLocale } from '@peera/i18n';
import { notFound } from 'next/navigation';
import { HomeLive } from '@/src/components/live/HomeLive';
import { translator } from '@/src/i18n';

/**
 * Tenant portal and owner side by side (01 §6.1). Both sides read the browser store (SPEC §2), so the page itself
 * makes no database call.
 */
export default async function RentrollHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { m } = translator(locale);
  return (
    <HomeLive
      locale={locale}
      labels={{ customer: m.roles.tenant, shop: m.roles.owner }}
    />
  );
}
