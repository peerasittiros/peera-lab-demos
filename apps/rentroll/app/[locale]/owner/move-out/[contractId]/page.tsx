import { PageHeader } from '@/src/components/PageHeader';
import { MoveOutForm } from '@/src/components/contracts/ContractForms';
import { loadContractDetail } from '@/src/db/queries/contracts';
import { bangkokDate } from '@/src/domain/dates';
import { pageContext } from '@/src/server/page';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ locale: string; contractId: string }> }) {
  const { contractId } = await params;
  const { locale, db, tenantId, m } = await pageContext(params);
  const today = bangkokDate(new Date());
  const detail = await loadContractDetail(db, tenantId, contractId, today);
  if (!detail || detail.contract.status === 'ended') notFound();
  const renter = detail.renters.find((r) => r.isPrimary)?.name ?? '—';
  return (
    <>
      <PageHeader
        locale={locale}
        title={`${m.contracts.moveOut.title} · ${detail.roomNumber}`}
        description={`${renter} · ${m.contracts.moveOut.intro}`}
      />
      <MoveOutForm locale={locale} contractId={contractId} today={today} />
    </>
  );
}
