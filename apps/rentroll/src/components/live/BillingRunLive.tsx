'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { Button, cn, focusRing, toast } from '@peera/ui';
import { useCallback, useState } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import {
  actAdjustDraftLines,
  actGenerateBilling,
  actSendBilling,
  actVoidDraft,
} from '@/src/client-store/commands/billing';
import { billingPlan } from '@/src/client-store/selectors/billing';
import type { StoreState } from '@/src/client-store/store';
import { missingReadings } from '@/src/domain/billing-run';
import { translator, type Messages } from '@/src/i18n';
import { PageHeader } from '@/src/components/PageHeader';
import { ReadyGate } from './ReadyGate';
import type { CommandContext } from '@/src/client-store/commands/payments';

const buildingsView = (s: StoreState) => s.data.building;
const periodOf = (s: StoreState) =>
  s.snapshotDate ? s.snapshotDate.slice(0, 7) : '';
const todayOf = (s: StoreState) => s.snapshotDate ?? '';

type Line = {
  id: string;
  kind: string;
  labelTh: string;
  labelEn: string;
  amountSatang: number;
  meta: Record<string, unknown>;
};

/**
 * The billing run (SPEC §4 O10): check the meters, review each draft and adjust its lines, generate the invoices, then
 * send them all. Works from the store, so it works offline; a sent invoice cannot be changed.
 */
export function BillingRunLive({
  locale,
  period: requested,
}: {
  locale: Locale;
  period: string;
}) {
  return (
    <ReadyGate locale={locale}>
      <BillingRunBody locale={locale} requested={requested} />
    </ReadyGate>
  );
}

function BillingRunBody({
  locale,
  requested,
}: {
  locale: Locale;
  requested: string;
}) {
  const { m } = translator(locale);
  const p = m.billing;
  const buildings = useStore(buildingsView);
  const currentPeriod = useStore(periodOf);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const role = useRole();
  const period = requested === 'current' ? currentPeriod : requested;
  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];
  const select = useCallback(
    (s: StoreState) =>
      building && period
        ? billingPlan(s.data, building.id, period, todayOf(s))
        : null,
    [building, period],
  );
  const plan = useStore(select);
  if (!building || !period) return null;

  const context = (): CommandContext => ({
    store: getStore(),
    role,
    now: () => new Date(),
  });
  const errorText = (key: string) => {
    const last = key.split('.').pop() as keyof Messages['billing']['errors'];
    return p.errors[last] ?? p.errors.saveFailed;
  };
  const report = (text: string) => {
    setMessage(text);
    toast({ title: text });
  };

  const rooms = plan?.rooms ?? [];
  const missing = rooms.filter(
    (r) =>
      !r.existingInvoiceId &&
      (missingReadings(r).electricity || missingReadings(r).water),
  );
  const drafts = (plan?.existing ?? []).filter((i) => i.status === 'draft');
  const steps = [
    { label: p.steps.meters, done: missing.length === 0 },
    { label: p.steps.review, done: (plan?.existing.length ?? 0) > 0 },
    {
      label: p.steps.generate,
      done: rooms.length > 0 && rooms.every((r) => r.existingInvoiceId),
    },
    {
      label: p.steps.send,
      done: (plan?.existing.length ?? 0) > 0 && drafts.length === 0,
    },
  ];
  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-11 items-center rounded-sm border px-4 text-ink',
      active ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
      focusRing,
    );
  const buildingName = (b: (typeof buildings)[number]) =>
    locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh);

  return (
    <>
      <PageHeader locale={locale} title={p.title} description={p.intro} />
      <p className="mb-4 tabular-nums text-ink-muted">{period}</p>
      <nav aria-label={p.steps.meters} className="mb-6 flex flex-wrap gap-2">
        {buildings.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={b.id === building.id}
            onClick={() => setBuildingId(b.id)}
            className={chip(b.id === building.id)}
          >
            {buildingName(b)}
          </button>
        ))}
      </nav>

      <ol className="mb-8 grid gap-2 md:grid-cols-4" aria-label={p.title}>
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-3"
          >
            <span className="text-ink-muted tabular-nums">{index + 1}</span>
            <span className="text-ink">{step.label}</span>
            <span className={step.done ? 'text-success' : 'text-ink-muted'}>
              {step.done ? p.done : p.todo}
            </span>
          </li>
        ))}
      </ol>

      {message ? (
        <p role="status" className="mb-6 text-ink">
          {message}
        </p>
      ) : null}

      <section className="mb-10 flex flex-col gap-3">
        <h2 className="text-ink">{p.steps.meters}</h2>
        {missing.length === 0 ? (
          <p className="text-ink-muted">{m.ownerLive.allRead}</p>
        ) : (
          <>
            <p className="text-ink-muted">{p.missingBody}</p>
            <ul className="flex flex-col gap-2">
              {missing.map((r) => {
                const gaps = missingReadings(r);
                const checked = estimates.includes(r.roomId);
                return (
                  <li
                    key={r.roomId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line bg-surface-raised p-3"
                  >
                    <span className="tabular-nums text-ink">
                      {r.roomNumber}
                    </span>
                    <span className="text-ink-muted">
                      {[
                        gaps.electricity ? m.meters.kind.electricity : null,
                        gaps.water ? m.meters.kind.water : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <label className="flex min-h-11 items-center gap-2 text-ink">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setEstimates((list) =>
                            e.target.checked
                              ? [...list, r.roomId]
                              : list.filter((id) => id !== r.roomId),
                          )
                        }
                        className="size-5"
                      />
                      <span>{p.estimate}</span>
                      <span className="text-ink-muted">{p.estimateHint}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <div>
          <Button
            type="button"
            variant="primary"
            locale={locale}
            disabled={
              rooms.every((r) => r.existingInvoiceId) || plan?.plan == null
            }
            onClick={() => {
              const result = actGenerateBilling(context(), {
                buildingId: building.id,
                period,
                estimateRoomIds: estimates,
              });
              if (!result.ok) return report(errorText(result.error));
              report(
                result.value.created > 0
                  ? `${m.ownerLive.generated}: ${result.value.created}`
                  : m.ownerLive.nothingToGenerate,
              );
            }}
          >
            {p.generate}
          </Button>
          {plan?.plan == null ? (
            <p className="mt-2 text-danger">{p.errors.noRatePlan}</p>
          ) : null}
        </div>
      </section>

      <section className="mb-10 flex flex-col gap-4">
        <h2 className="text-ink">{p.reviewTitle}</h2>
        <p className="text-ink-muted">{p.reviewBody}</p>
        {(plan?.existing.length ?? 0) === 0 ? (
          <p className="text-ink-muted">{p.noRoomsThisMonth}</p>
        ) : null}
        {(plan?.existing ?? []).map((inv) => (
          <DraftCard
            key={`${inv.id}-${inv.status}-${inv.totalSatang}`}
            locale={locale}
            m={m}
            invoice={inv}
            context={context}
            onReport={report}
            errorText={errorText}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-ink-muted">{m.ownerLive.lockedNote}</p>
        <div>
          <Button
            type="button"
            variant="primary"
            locale={locale}
            disabled={drafts.length === 0}
            onClick={() => {
              const result = actSendBilling(context(), {
                buildingId: building.id,
                period,
              });
              if (!result.ok) return report(errorText(result.error));
              report(
                result.value.sent > 0
                  ? `${m.ownerLive.sentDone}: ${result.value.sent}`
                  : m.ownerLive.nothingToSend,
              );
            }}
          >
            {p.send}
          </Button>
        </div>
      </section>
    </>
  );
}

type PlanInvoice = NonNullable<
  ReturnType<typeof billingPlan>
>['existing'][number];

/** One invoice in the review: its lines can be edited, added or removed while it is a draft. */
function DraftCard({
  locale,
  m,
  invoice,
  context,
  onReport,
  errorText,
}: {
  locale: Locale;
  m: Messages;
  invoice: PlanInvoice;
  context: () => CommandContext;
  onReport: (text: string) => void;
  errorText: (key: string) => string;
}) {
  const p = m.billing;
  const draft = invoice.status === 'draft';
  const [lines, setLines] = useState<Line[]>(
    invoice.lines.map((l) => ({
      ...l,
      meta: l.meta as Record<string, unknown>,
    })),
  );
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const total = lines.reduce((sum, l) => sum + l.amountSatang, 0);

  const save = () => {
    const result = actAdjustDraftLines(context(), {
      invoiceId: invoice.id,
      lines: lines.map((l) => ({
        id: l.id,
        kind: l.kind as 'rent',
        labelTh: l.labelTh,
        labelEn: l.labelEn,
        amountSatang: l.amountSatang,
        meta: l.meta,
      })),
    });
    onReport(result.ok ? m.ownerLive.linesSaved : errorText(result.error));
  };

  return (
    <details
      className="rounded-sm border border-line bg-surface-raised p-4"
      open={draft}
    >
      <summary className="flex min-h-11 flex-wrap items-center justify-between gap-3 text-ink">
        <span className="tabular-nums">{invoice.roomNumber}</span>
        <span className="tabular-nums">{invoice.number}</span>
        <span className="text-ink-muted">
          {p.status[invoice.status as keyof typeof p.status] ?? invoice.status}
        </span>
        <span className="tabular-nums">
          {formatMoney(draft ? total : invoice.totalSatang, locale)}
        </span>
      </summary>
      <ul className="mt-4 flex flex-col gap-2">
        {lines.map((line, index) => (
          <li
            key={line.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3"
          >
            <span className="text-ink">
              {locale === 'th' ? line.labelTh : line.labelEn}
              {line.meta.estimate === true ? (
                <span className="text-ink-muted"> {p.estimated}</span>
              ) : null}
            </span>
            {draft ? (
              <input
                aria-label={locale === 'th' ? line.labelTh : line.labelEn}
                inputMode="decimal"
                value={(line.amountSatang / 100).toFixed(2)}
                onChange={(e) => {
                  const value = Math.max(
                    0,
                    Math.round(Number(e.target.value) * 100) || 0,
                  );
                  setLines((list) =>
                    list.map((l, i) =>
                      i === index ? { ...l, amountSatang: value } : l,
                    ),
                  );
                }}
                className="min-h-11 w-32 rounded-sm border border-line-strong bg-surface-raised px-3 text-right text-ink tabular-nums"
              />
            ) : (
              <span className="tabular-nums">
                {formatMoney(line.amountSatang, locale)}
              </span>
            )}
            {draft ? (
              <button
                type="button"
                onClick={() =>
                  setLines((list) => list.filter((_, i) => i !== index))
                }
                className={cn(
                  'min-h-11 rounded-sm px-2 text-ink-muted hover:text-ink',
                  focusRing,
                )}
              >
                {m.ownerLive.removeLine}
              </button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
      {draft ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-ink-muted">
              <span>{m.ownerLive.lineLabelEn}</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="min-h-11 rounded-sm border border-line-strong bg-surface-raised px-3 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-ink-muted">
              <span>{m.ownerLive.lineAmount}</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-h-11 w-32 rounded-sm border border-line-strong bg-surface-raised px-3 text-right text-ink tabular-nums"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              locale={locale}
              disabled={label.trim() === '' || amount === ''}
              onClick={() => {
                const value = Math.round(Number(amount) * 100);
                setLines((list) => [
                  ...list,
                  {
                    id: crypto.randomUUID(),
                    kind: 'extra',
                    labelTh: label.trim(),
                    labelEn: label.trim(),
                    amountSatang: value,
                    meta: {},
                  },
                ]);
                setLabel('');
                setAmount('');
              }}
            >
              {m.ownerLive.addLine}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              locale={locale}
              onClick={save}
            >
              {m.ownerLive.saveLines}
            </Button>
            <Button
              type="button"
              variant="danger"
              locale={locale}
              onClick={() => {
                const result = actVoidDraft(context(), {
                  invoiceId: invoice.id,
                });
                onReport(
                  result.ok ? m.ownerLive.voided : errorText(result.error),
                );
              }}
            >
              {m.ownerLive.voidDraft}
            </Button>
          </div>
        </div>
      ) : null}
    </details>
  );
}
