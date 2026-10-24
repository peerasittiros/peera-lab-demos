'use client';

import type { Locale } from '@peera/i18n';
import { useStore } from '@/src/client-store/hooks';
import { translator } from '@/src/i18n';
import { PageHeader } from '@/src/components/PageHeader';
import { BillsView } from '@/src/components/tenant/TenantViews';
import { ReadyGate } from './ReadyGate';
import { billsView } from './views';

/** The tenant's bills and usage for twelve months, from the browser store. */
export function TenantBillsLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <TenantBillsBody locale={locale} />
    </ReadyGate>
  );
}

function TenantBillsBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const data = useStore(billsView);
  return (
    <>
      <PageHeader locale={locale} title={m.tenant.bills.title} />
      <BillsView
        locale={locale}
        bills={data?.bills ?? []}
        usage={data?.usage ?? []}
      />
    </>
  );
}
