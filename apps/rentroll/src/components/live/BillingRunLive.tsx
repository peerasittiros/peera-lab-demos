'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { Button, cn, focusRing, toast, ts } from '@peera/ui';
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
import { formatDay, formatPeriod, translator, type Messages } from '@/src/i18n';
import { PageHeader } from '@/src/components/PageHeader';
import { PaidStamp } from '@/src/components/property/PaidStamp';
import { RollingNumber } from '@/src/components/RollingNumber';
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
  const allGenerated =
    rooms.length > 0 && rooms.every((r) => r.existingInvoiceId);
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
      <p className="mb-4 text-ink-muted">{formatPeriod(period, locale)}</p>
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
            variant={allGenerated ? 'secondary' : 'primary'}
            locale={locale}
            disabled={allGenerated || plan?.plan == null}
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
        <div className="grid gap-4 lg:grid-cols-2">
          {(plan?.existing ?? []).map((inv) => (
            <DraftCard
              key={`${inv.id}-${inv.status}-${inv.totalSatang}`}
              locale={locale}
              m={m}
              buildingName={buildingName(building)}
              invoice={inv}
              context={context}
              onReport={report}
              errorText={errorText}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-ink-muted">{m.ownerLive.lockedNote}</p>
        <div>
          <Button
            type="button"
            variant={allGenerated ? 'primary' : 'secondary'}
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

/**
 * One bill as the tenant will see it (ux-v2/rentroll.md › Bills): building and room, the lines, the total in the
 * numeric face, the due date in the reader's calendar, and the sample QR (never a payable code, 01 §6.3). While it is
 * a draft its lines can be edited, added or removed.
 */
function DraftCard({
  locale,
  m,
  buildingName,
  invoice,
  context,
  onReport,
  errorText,
}: {
  locale: Locale;
  m: Messages;
  buildingName: string;
  invoice: PlanInvoice;
  context: () => CommandContext;
  onReport: (text: string) => void;
  errorText: (key: string) => string;
}) {
  const { t } = translator(locale);
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
  const [editing, setEditing] = useState(false);
  const total = lines.reduce((sum, l) => sum + l.amountSatang, 0);
  const shownTotal = draft ? total : invoice.totalSatang;

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

  const titleId = `bill-${invoice.id}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
            {buildingName}
          </span>
          <h3 id={titleId} className="room-number m-0 text-ink">
            <span className="sr-only">
              {t('billing.billFor', { room: '' })}
            </span>
            {invoice.roomNumber}
          </h3>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono tabular-nums text-ink">
            {invoice.number}
          </span>
          <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
            {/* A paid bill says so with the stamp below the total; the word stays here for screen readers. */}
            {invoice.status === 'paid' ? (
              <span className="sr-only">{p.status.paid}</span>
            ) : (
              (p.status[invoice.status as keyof typeof p.status] ??
              invoice.status)
            )}
          </span>
        </div>
      </header>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.map((line, index) => (
          <li
            key={line.id}
            className={cn(
              'grid items-center gap-3',
              draft && editing
                ? 'grid-cols-[1fr_auto_auto]'
                : 'grid-cols-[1fr_auto]',
            )}
          >
            <span className="text-ink">
              {locale === 'th' ? line.labelTh : line.labelEn}
              {line.meta.estimate === true ? (
                <span className="text-ink-muted"> {p.estimated}</span>
              ) : null}
            </span>
            {draft && editing ? (
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
              <span className="money text-ink">
                {formatMoney(line.amountSatang, locale)}
              </span>
            )}
            {draft && editing ? (
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
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className={cn(ts('label', locale), 'text-ink')}>
          {p.billTotal}
        </span>
        <span className="money-lg text-ink">
          <RollingNumber
            value={shownTotal}
            format={(value) => formatMoney(value, locale)}
          />
        </span>
      </div>
      {invoice.status === 'paid' ? (
        <div className="flex justify-end">
          <PaidStamp locale={locale} word={p.status.paid} />
        </div>
      ) : null}
      <p className="m-0 text-ink-muted">
        {t('billing.dueOn', { date: formatDay(invoice.dueDate, locale) })}
      </p>
      <div className="flex flex-col gap-1 rounded-sm border border-dashed border-line-strong p-3">
        <span className={cn(ts('label', locale), 'text-ink')}>
          {m.payments.pay.sample}
        </span>
        <code className="break-all font-mono text-ink-muted">{`RENTROLL-DEMO-${invoice.number}-${(shownTotal / 100).toFixed(2)}`}</code>
      </div>
      {draft ? (
        <Button
          type="button"
          variant="ghost"
          locale={locale}
          aria-expanded={editing}
          onClick={() => setEditing((value) => !value)}
          className="self-start"
        >
          {editing ? p.stopEditing : p.editLines}
        </Button>
      ) : null}
      {draft && editing ? (
        <div className="flex flex-col gap-3">
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
    </article>
  );
}
