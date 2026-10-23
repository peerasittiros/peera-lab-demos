import { PageHeader } from '@/src/components/PageHeader';
import { BillingRun } from '@/src/components/billing/BillingRun';
import { loadBillingPlan } from '@/src/db/queries/billing';
import { loadProperty } from '@/src/db/queries/property';
import { bangkokDate } from '@/src/domain/dates';
import { previewBilling } from '@/src/db/writes/billing';
import { pageContext, param, type SearchParams } from '@/src/server/page';
import { formatMoney } from '@peera/i18n';
import { cn, focusRing, StatusBadge } from '@peera/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/** Owner billing run (01 §3.1 C.9): check meters, review, generate, send. `current` is the current Bangkok month. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; period: string }>;
  searchParams: SearchParams;
}) {
  const { period: requested } = await params;
  const { locale, db, tenantId, m } = await pageContext(params);
  const now = new Date();
  const today = bangkokDate(now);
  const period = requested === 'current' ? today.slice(0, 7) : requested;
  if (!/^\d{4}-\d{2}$/.test(period)) notFound();

  const query = await searchParams;
  const { buildings } = await loadProperty(db, tenantId, today);
  const building = buildings.find((b) => b.id === param(query.b)) ?? buildings[0];
  if (!building) notFound();
  const plan = await loadBillingPlan(db, tenantId, { buildingId: building.id, period, today });
  if (!plan) notFound();

  const planned = previewBilling(plan, [], now, period);
  const missing = planned
    .filter((p) => p.missing.electricity || p.missing.water)
    .map((p) => ({ roomId: p.roomId, roomNumber: p.roomNumber, electricity: p.missing.electricity, water: p.missing.water }));
  const drafts = plan.existing.filter((i) => i.status === 'draft').length;
  const p = m.billing;
  const steps = [
    { key: 'meters', label: p.steps.meters, done: missing.length === 0 },
    { key: 'review', label: p.steps.review, done: plan.existing.length > 0 },
    // Generated once every room with a contract has its invoice (blocked rooms still count as not generated).
    { key: 'generate', label: p.steps.generate, done: planned.length === 0 && plan.existing.length > 0 },
    { key: 'send', label: p.steps.send, done: plan.existing.length > 0 && drafts === 0 },
  ];
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-[44px] items-center rounded-sm border px-4 text-ink',
      active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
      focusRing,
    );
  const buildingName = (b: (typeof buildings)[number]) => (locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh));
  const canGenerate = planned.some((row) => row.total !== null) || missing.length > 0;

  return (
    <>
      <PageHeader locale={locale} title={p.title} description={p.intro} />
      <p className="mb-4 tabular-nums text-ink-muted">{period}</p>
      <nav aria-label={p.steps.meters} className="mb-6 flex flex-wrap gap-2">
        {buildings.map((b) => (
          <Link key={b.id} href={`/${locale}/owner/billing/${period}?b=${b.id}`} aria-current={b.id === building.id ? 'page' : undefined} className={chip(b.id === building.id)}>
            {buildingName(b)}
          </Link>
        ))}
      </nav>

      <ol className="mb-8 grid gap-2 md:grid-cols-4" aria-label={p.title}>
        {steps.map((step, index) => (
          <li key={step.key} className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-3">
            <span className="text-ink-muted tabular-nums">{index + 1}</span>
            <span className="text-ink">{step.label}</span>
            <StatusBadge tone={step.done ? 'success' : 'neutral'} label={step.done ? p.done : p.todo} locale={locale} />
          </li>
        ))}
      </ol>

      <BillingRun
        locale={locale}
        buildingId={building.id}
        period={period}
        missing={missing}
        drafts={drafts}
        hasPlan={plan.plan !== null}
        canGenerate={canGenerate}
        invoices={plan.existing.map((i) => ({ id: i.id, number: i.number, roomNumber: i.roomNumber, status: i.status, totalSatang: i.totalSatang }))}
      />

      <section className="mt-10 flex flex-col gap-3">
        <h2 className={cn('text-ink')}>{p.reviewTitle}</h2>
        <p className="text-ink-muted">{p.reviewBody}</p>
        {plan.existing.length === 0 && planned.length === 0 ? (
          <p className="text-ink-muted">{p.noRoomsThisMonth}</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {plan.existing.map((inv) => (
            <li key={inv.id}>
              <details className="rounded-sm border border-line bg-surface-raised p-3">
                <summary className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 text-ink">
                  <span className="tabular-nums">{inv.roomNumber}</span>
                  <span className="tabular-nums">{inv.number}</span>
                  <StatusBadge tone={inv.status === 'void' ? 'neutral' : inv.status === 'draft' ? 'info' : 'success'} label={p.status[inv.status as keyof typeof p.status] ?? inv.status} locale={locale} />
                  <span className="tabular-nums">{formatMoney(inv.totalSatang, locale)}</span>
                </summary>
                <ul className="mt-3 flex flex-col gap-1">
                  {inv.lines.map((line) => (
                    <li key={line.id} className="flex justify-between gap-4 text-ink">
                      <span>
                        {locale === 'th' ? line.labelTh : line.labelEn}
                        {line.meta.estimate === true ? <span className="text-ink-muted"> {p.estimated}</span> : null}
                      </span>
                      <span className="tabular-nums">{formatMoney(line.amountSatang, locale)}</span>
                    </li>
                  ))}
                </ul>
                {inv.status !== 'draft' && inv.status !== 'void' ? (
                  <Link href={`/i/${inv.publicToken}?lang=${locale}`} className={cn('mt-3 inline-flex min-h-[44px] items-center text-ink underline-offset-4 hover:underline', focusRing)}>
                    {m.billing.public.title}
                  </Link>
                ) : null}
              </details>
            </li>
          ))}
          {planned.length > 0 ? (
            <li className="mt-4">
              <h3 className="mb-2 text-ink-muted">{p.plannedTitle}</h3>
              <ul className="flex flex-col gap-1">
                {planned.map((row) => (
                  <li key={row.roomId} className="flex justify-between gap-4 text-ink">
                    <span className="tabular-nums">{row.roomNumber}</span>
                    <span className="tabular-nums">{row.total !== null ? formatMoney(row.total, locale) : p.errors.missingReadings}</span>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
        </ul>
        {plan.plan === null ? <p className="text-danger">{p.errors.noRatePlan}</p> : null}
      </section>
    </>
  );
}
