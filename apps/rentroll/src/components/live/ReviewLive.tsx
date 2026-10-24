'use client';

import type { Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Field,
  focusRing,
  Input,
  Select,
  toast,
  ts,
} from '@peera/ui';
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
import { translator, type Messages } from '@/src/i18n';
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

function ReviewBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.payments;
  const queue = useStore(reviewQueueView);
  const contracts = useStore(payableContractsView);
  const role = useRole();
  const context = (): CommandContext => ({
    store: getStore(),
    role,
    now: () => new Date(),
  });

  return (
    <>
      {queue.length === 0 ? (
        <p className="text-ink-muted">{p.empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {queue.map((item) => (
            <ReviewCard
              key={item.id}
              locale={locale}
              m={m}
              item={item}
              context={context}
            />
          ))}
        </div>
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

type QueueItem = ReturnType<typeof reviewQueueView>[number];

/** Baht typed → satang. */
const toSatang = (raw: string) =>
  Math.round(Number(raw.replace(/,/g, '')) * 100);

function failureText(m: Messages, key: string): string {
  const last = key.split('.').pop() as keyof Messages['payments']['errors'];
  return m.payments.errors[last] ?? m.payments.errors.saveFailed;
}

/** One slip: its image, the invoices it can settle, approve (A) and reject with a reason (R). */
function ReviewCard({
  locale,
  m,
  item,
  context,
}: {
  locale: Locale;
  m: Messages;
  item: QueueItem;
  context: () => CommandContext;
}) {
  const p = m.payments;
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [approveBaht, setApproveBaht] = useState(
    (item.amountSatang / 100).toFixed(2),
  );
  const [reason, setReason] = useState('');
  const reasonRef = useRef<HTMLInputElement>(null);
  const image = slipImageUrl(item.id, item.slipUrl);

  const approve = () => {
    setBusy('approve');
    const result = actApprovePayment(context(), {
      paymentId: item.id,
      amountSatang: toSatang(approveBaht),
    });
    setBusy(null);
    toast({
      title: result.ok
        ? `${p.receipt} ${result.value.receiptNumber}`
        : failureText(m, result.error),
    });
  };

  const reject = () => {
    setBusy('reject');
    const result = actRejectPayment(context(), {
      paymentId: item.id,
      reason: reason.trim(),
    });
    setBusy(null);
    if (!result.ok) toast({ title: failureText(m, result.error) });
  };

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'a' || event.key === 'A') approve();
    if (event.key === 'r' || event.key === 'R') reasonRef.current?.focus();
  };

  return (
    <section
      tabIndex={0}
      onKeyDown={onKey}
      aria-label={item.roomNumber}
      lang={locale}
      className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-4 md:p-5 focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={cn(ts('title', locale), 'tabular-nums text-ink')}>
          {item.roomNumber}
        </h2>
        <span className="tabular-nums text-ink">
          {(item.amountSatang / 100).toFixed(2)}
        </span>
      </div>
      {image ? (
        <img
          src={image}
          alt={m.tenant.live.slipAlt}
          className="max-h-72 w-full rounded-sm border border-line bg-surface-sunken object-contain"
        />
      ) : (
        <p
          className={cn(
            locale === 'th' ? 'caption-th' : 'caption',
            'text-ink-muted',
          )}
        >
          {m.tenant.live.slipPlaceholder}
        </p>
      )}
      <ul className="flex flex-col gap-1 text-ink-muted">
        {item.open.map((invoice) => (
          <li key={invoice.id} className="flex justify-between gap-3">
            <span className="tabular-nums">{invoice.number}</span>
            <span className="tabular-nums">
              {(invoice.outstanding / 100).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-ink-muted">{p.shortcuts}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={p.approveAmount} locale={locale}>
          <Input
            value={approveBaht}
            inputMode="decimal"
            onChange={(e) => setApproveBaht(e.target.value)}
          />
        </Field>
        <Button
          type="button"
          variant="primary"
          locale={locale}
          loading={busy === 'approve'}
          onClick={approve}
        >
          {p.approve}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={p.reason} locale={locale}>
          <Input
            ref={reasonRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Button
          type="button"
          variant="danger"
          locale={locale}
          loading={busy === 'reject'}
          disabled={reason.trim() === ''}
          onClick={reject}
        >
          {p.reject}
        </Button>
      </div>
    </section>
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
