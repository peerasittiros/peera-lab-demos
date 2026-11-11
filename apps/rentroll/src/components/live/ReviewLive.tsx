'use client';

import { formatMoney, type Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Field,
  focusRing,
  Input,
  Select,
  Textarea,
  toast,
  ts,
} from '@peera/ui';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import {
  actApprovePayment,
  actRecordManualPayment,
  actRejectPayment,
  type CommandContext,
} from '@/src/client-store/commands/payments';
import { slipImageUrl } from '@/src/client-store/slip-images';
import { slipCheck } from '@/src/domain/slip-check';
import { formatDay, translator, type Messages } from '@/src/i18n';
import { ReadyGate } from './ReadyGate';
import { payableContractsView, reviewQueueView } from './views';

/** The owner's payment review (SPEC §4 O12): the slip queue and manual entry, all from the browser store. */
export function ReviewLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <ReviewBody locale={locale} />
    </ReadyGate>
  );
}

type QueueItem = ReturnType<typeof reviewQueueView>[number];

/** Baht typed → satang. */
const toSatang = (raw: string) =>
  Math.round(Number(raw.replace(/,/g, '')) * 100);

function failureText(m: Messages, key: string): string {
  const last = key.split('.').pop() as keyof Messages['payments']['errors'];
  return m.payments.errors[last] ?? m.payments.errors.saveFailed;
}

/**
 * The slip queue, one slip at a time (ux-v2/rentroll.md › Payments). After Approve or Ask the tenant the slip stays on
 * screen with the outcome until the owner moves on: nothing advances by itself.
 */
function ReviewBody({ locale }: { locale: Locale }) {
  const { m, t } = translator(locale);
  const p = m.payments;
  const queue = useStore(reviewQueueView);
  const contracts = useStore(payableContractsView);
  const role = useRole();
  const context = (): CommandContext => ({
    store: getStore(),
    role,
    now: () => new Date(),
  });
  // The store takes a slip out of the queue as soon as it is decided, so the decided slip is kept here.
  const [decided, setDecided] = useState<{
    item: QueueItem;
    outcome: string;
  } | null>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const shown = decided?.item ?? queue[0] ?? null;
  const total = queue.length + (decided ? 1 : 0);

  const onDone = (item: QueueItem, outcome: string) => {
    setDecided({ item, outcome });
    requestAnimationFrame(() => outcomeRef.current?.focus());
  };

  return (
    <>
      {shown ? (
        <section aria-label={p.title} className="flex flex-col gap-3">
          <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
            {t('payments.slipOf', { index: 1, total })}
          </p>
          <ReviewCard
            key={shown.id}
            locale={locale}
            m={m}
            item={shown}
            context={context}
            onDone={onDone}
            decided={decided !== null}
          />
          {decided ? (
            <div
              ref={outcomeRef}
              tabIndex={-1}
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line bg-surface-raised p-4 outline-none"
            >
              <span className="flex items-center gap-2 text-ink">
                <CheckCircle2
                  aria-hidden
                  size={18}
                  strokeWidth={2}
                  className="text-success"
                />
                {decided.outcome}
              </span>
              {queue.length > 0 ? (
                <Button
                  type="button"
                  variant="primary"
                  locale={locale}
                  onClick={() => setDecided(null)}
                >
                  {p.nextSlip}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  locale={locale}
                  onClick={() => setDecided(null)}
                >
                  {m.common.back}
                </Button>
              )}
            </div>
          ) : null}
        </section>
      ) : (
        <p role="status" className="flex items-center gap-2 text-ink">
          <CheckCircle2
            aria-hidden
            size={18}
            strokeWidth={2}
            className="text-success"
          />
          {p.queueDone}
        </p>
      )}
      <section className="mt-10 flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-4 md:p-5">
        <h2 className={cn(ts('title', locale), 'text-ink')}>
          {p.manual.title}
        </h2>
        <ManualPaymentForm
          locale={locale}
          m={m}
          context={context}
          contracts={contracts.map((c) => ({
            contractId: c.contractId,
            label: `${c.roomNumber}${c.renterName ? ` · ${c.renterName}` : ''}`,
          }))}
        />
      </section>
    </>
  );
}

/**
 * One slip: the slip on the left, the bills it settles on the right, the amount check as icon and word, then Approve
 * or Ask the tenant (with what to fix). From 768 the keys A (approve) and R (ask) work while the card has focus.
 */
function ReviewCard({
  locale,
  m,
  item,
  context,
  onDone,
  decided,
}: {
  locale: Locale;
  m: Messages;
  item: QueueItem;
  context: () => CommandContext;
  onDone: (item: QueueItem, outcome: string) => void;
  decided: boolean;
}) {
  const { t } = translator(locale);
  const p = m.payments;
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [approveBaht, setApproveBaht] = useState(
    (item.amountSatang / 100).toFixed(2),
  );
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const image = slipImageUrl(item.id, item.slipUrl);
  const check = slipCheck(item.amountSatang, item.open);
  const CheckIcon = check.kind === 'match' ? CheckCircle2 : AlertTriangle;

  const approve = () => {
    if (decided) return;
    setBusy('approve');
    const result = actApprovePayment(context(), {
      paymentId: item.id,
      amountSatang: toSatang(approveBaht),
    });
    setBusy(null);
    if (!result.ok) {
      setError(failureText(m, result.error));
      return;
    }
    onDone(
      item,
      t('payments.approvedDone', { receipt: result.value.receiptNumber }),
    );
  };

  const ask = () => {
    setBusy('reject');
    const result = actRejectPayment(context(), {
      paymentId: item.id,
      reason: reason.trim(),
    });
    setBusy(null);
    if (!result.ok) {
      setError(failureText(m, result.error));
      return;
    }
    onDone(item, p.askedDone);
  };

  const openAsk = () => {
    setAsking(true);
    requestAnimationFrame(() => reasonRef.current?.focus());
  };

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (
      decided ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return;
    if (event.key === 'a' || event.key === 'A') approve();
    if (event.key === 'r' || event.key === 'R') openAsk();
  };

  return (
    <article
      tabIndex={0}
      onKeyDown={onKey}
      aria-labelledby={`slip-${item.id}`}
      lang={locale}
      className="grid gap-5 rounded-sm border border-line bg-surface-raised p-4 focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring md:grid-cols-2 md:p-5"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id={`slip-${item.id}`} className="room-number m-0 text-ink">
            {item.roomNumber}
          </h2>
          {item.renterName ? (
            <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
              {item.renterName}
            </span>
          ) : null}
        </div>
        {image ? (
          <img
            src={image}
            alt={m.tenant.live.slipAlt}
            className="max-h-80 w-full rounded-sm border border-line bg-surface-sunken object-contain"
          />
        ) : (
          <p
            className={cn(
              locale === 'th' ? 'caption-th' : 'caption',
              'm-0 rounded-sm border border-dashed border-line-strong p-4 text-ink-muted',
            )}
          >
            {m.tenant.live.slipPlaceholder}
          </p>
        )}
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-ink-muted">{p.slipAmount}</dt>
          <dd className="money m-0 text-right text-ink">
            {formatMoney(item.amountSatang, locale)}
          </dd>
          <dt className="text-ink-muted">{p.paidAt}</dt>
          <dd className="m-0 text-right text-ink">
            {formatDay(item.paidAt, locale)}
          </dd>
        </dl>
      </div>

      <div className="flex flex-col gap-4">
        <section
          aria-labelledby={`bills-${item.id}`}
          className="flex flex-col gap-2"
        >
          <h3
            id={`bills-${item.id}`}
            className={cn(ts('label', locale), 'm-0 text-ink')}
          >
            {p.billsToSettle}
          </h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {item.open.map((invoice) => (
              <li
                key={invoice.id}
                className="flex justify-between gap-3 border-b border-line py-1.5"
              >
                <span className="font-mono tabular-nums text-ink">
                  {invoice.number}
                </span>
                <span className="money text-ink">
                  {formatMoney(invoice.outstanding, locale)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between gap-3">
            <span className="text-ink-muted">{p.owed}</span>
            <span className="money text-ink">
              {formatMoney(item.owedSatang, locale)}
            </span>
          </div>
        </section>

        <p
          className={cn(
            'm-0 flex items-center gap-2',
            check.kind === 'match' ? 'text-success' : 'text-warning',
          )}
        >
          <CheckIcon aria-hidden size={18} strokeWidth={2} />
          {check.kind === 'match'
            ? p.matches
            : t(check.kind === 'short' ? 'payments.short' : 'payments.over', {
                amount: formatMoney(check.diff, locale),
              })}
        </p>

        {error ? (
          <p role="alert" className="m-0 text-danger">
            {error}
          </p>
        ) : null}

        {decided ? null : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                locale={locale}
                loading={busy === 'approve'}
                onClick={approve}
              >
                {p.approve}
              </Button>
              <Button
                type="button"
                variant="secondary"
                locale={locale}
                aria-expanded={asking}
                onClick={openAsk}
              >
                {p.askTenant}
              </Button>
            </div>
            {asking ? (
              <div className="flex flex-col gap-3">
                <Field label={p.askReason} locale={locale}>
                  <Textarea
                    ref={reasonRef}
                    value={reason}
                    rows={2}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  locale={locale}
                  loading={busy === 'reject'}
                  disabled={reason.trim() === ''}
                  onClick={ask}
                  className="self-start"
                >
                  {p.sendAsk}
                </Button>
              </div>
            ) : null}
            <details>
              <summary
                className={cn(
                  ts('ui', locale),
                  'min-h-11 cursor-pointer py-2 text-ink-muted',
                  focusRing,
                )}
              >
                {p.changeAmount}
              </summary>
              <Field label={p.approveAmount} locale={locale}>
                <Input
                  value={approveBaht}
                  inputMode="decimal"
                  onChange={(e) => setApproveBaht(e.target.value)}
                />
              </Field>
            </details>
            <p
              className={cn(
                ts('body-sm', locale),
                'm-0 hidden text-ink-muted md:block',
              )}
            >
              {p.shortcuts}
            </p>
          </>
        )}
      </div>
    </article>
  );
}

/** Cash or transfer entered by the owner. Approved at once, settled the same way as a slip. */
function ManualPaymentForm({
  locale,
  m,
  contracts,
  context,
}: {
  locale: Locale;
  m: Messages;
  contracts: { contractId: string; label: string }[];
  context: () => CommandContext;
}) {
  const p = m.payments.manual;
  const [error, setError] = useState<string | null>(null);
  const [contractId, setContractId] = useState(contracts[0]?.contractId ?? '');
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash');

  if (contracts.length === 0) return <p className="text-ink-muted">{p.none}</p>;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = actRecordManualPayment(context(), {
      contractId,
      amountSatang: toSatang(String(data.get('amount') ?? '')),
      method,
    });
    if (!result.ok) {
      setError(failureText(m, result.error));
      return;
    }
    setError(null);
    event.currentTarget.reset();
    toast({ title: `${m.payments.receipt} ${result.value.receiptNumber}` });
  };

  return (
    <form onSubmit={submit} lang={locale} className="grid gap-4 md:grid-cols-2">
      <Field label={p.contract} locale={locale} required>
        <Select
          locale={locale}
          value={contractId}
          onValueChange={setContractId}
          options={contracts.map((c) => ({
            value: c.contractId,
            label: c.label,
          }))}
        />
      </Field>
      <Field label={p.amount} locale={locale} required>
        <Input
          name="amount"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          required
        />
      </Field>
      <Field label={p.method} locale={locale} required>
        <Select
          locale={locale}
          value={method}
          onValueChange={(value) =>
            setMethod(value === 'transfer' ? 'transfer' : 'cash')
          }
          options={[
            { value: 'cash', label: p.cash },
            { value: 'transfer', label: p.transfer },
          ]}
        />
      </Field>
      {error ? (
        <p
          role="alert"
          className={`${ts('body', locale)} text-danger md:col-span-2`}
        >
          {error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button
          type="submit"
          variant="secondary"
          locale={locale}
          className={focusRing}
        >
          {p.record}
        </Button>
      </div>
    </form>
  );
}
