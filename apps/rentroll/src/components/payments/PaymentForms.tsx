'use client';

import type { Locale } from '@peera/i18n';
import { Button, Field, Input, Select, toast, ts } from '@peera/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  approvePaymentNow,
  recordManualPaymentNow,
  rejectPaymentNow,
  sendReminderNow,
  submitSlipNow,
} from '../../actions/payments';
import { translator, type Messages } from '../../i18n';

type Failure = { ok: false; error: { messageKey: string } };

/** Baht typed by the user → integer satang. */
function toSatang(raw: string): number {
  const value = Math.round(Number(raw.replace(/,/g, '')) * 100);
  return Number.isFinite(value) ? value : 0;
}

function failureText(m: Messages, result: Failure): string {
  const key = result.error.messageKey.split('.').pop() as keyof Messages['payments']['errors'];
  return m.payments.errors[key] ?? m.payments.errors.saveFailed;
}

/** Refreshes the page every two seconds so a new slip reaches the owner's review queue (01 §8 screen 9). */
export function AutoRefresh({ everyMs = 2000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs, router]);
  return null;
}

/** The tenant's transfer slip. The amount is recorded; the image is not stored in the demo. */
export function SlipForm({ locale, invoiceId, outstandingSatang }: { locale: Locale; invoiceId: string; outstandingSatang: number }) {
  const { m } = translator(locale);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const p = m.payments.pay;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('slip');
    setSaving(true);
    const result = await submitSlipNow({
      invoiceId,
      amountSatang: toSatang(String(data.get('amount') ?? '')),
      slipUrl: file instanceof File && file.size > 0 ? 'demo://slip-not-stored' : null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(failureText(m, result));
      toast({ title: failureText(m, result) });
      return;
    }
    setError(null);
    setSent(true);
    router.refresh();
  };

  if (sent) return <p className={`${ts('body', locale)} text-ink`}>{p.sent}</p>;
  return (
    <form onSubmit={submit} lang={locale} className="flex flex-col gap-4">
      <Field label={p.amount} locale={locale} required>
        <Input name="amount" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={(outstandingSatang / 100).toFixed(2)} required />
      </Field>
      <Field label={p.slip} hint={p.slipNote} locale={locale}>
        <input name="slip" type="file" accept="image/*" className="min-h-[44px] text-ink" />
      </Field>
      {error ? (
        <p role="alert" className={`${ts('body', locale)} text-danger`}>
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="primary" locale={locale} loading={saving}>
          {p.submit}
        </Button>
      </div>
    </form>
  );
}

export type ReviewItemView = {
  id: string;
  amountSatang: number;
  paidAt: string;
  roomNumber: string;
  renterName: string | null;
  owedSatang: number;
  open: { id: string; number: string; outstanding: number }[];
};

/**
 * One slip in the review queue. A approves the slip amount; R moves to the reason box. Approving settles the oldest
 * invoice first (01 §4) and the server issues the receipt.
 */
export function ReviewCard({ locale, item }: { locale: Locale; item: ReviewItemView }) {
  const { m } = translator(locale);
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [approveBaht, setApproveBaht] = useState((item.amountSatang / 100).toFixed(2));
  const [reason, setReason] = useState('');
  const reasonRef = useRef<HTMLInputElement>(null);
  const p = m.payments;

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'a' || event.key === 'A') void approve();
    if (event.key === 'r' || event.key === 'R') reasonRef.current?.focus();
  };

  async function approve() {
    setBusy('approve');
    const result = await approvePaymentNow({ paymentId: item.id, amountSatang: toSatang(approveBaht) });
    setBusy(null);
    if (!result.ok) {
      toast({ title: failureText(m, result) });
      return;
    }
    toast({ title: `${m.payments.receipt} ${result.data.receiptNumber}` });
    router.refresh();
  }

  const reject = async () => {
    setBusy('reject');
    const result = await rejectPaymentNow({ paymentId: item.id, reason: reason.trim() });
    setBusy(null);
    if (!result.ok) {
      toast({ title: failureText(m, result) });
      return;
    }
    router.refresh();
  };

  return (
    <section
      tabIndex={0}
      onKeyDown={onKey}
      aria-label={`${item.roomNumber}`}
      lang={locale}
      className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-4 md:p-5 focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className={`${ts('title', locale)} tabular-nums text-ink`}>{item.roomNumber}</h2>
        <span className="tabular-nums text-ink">{(item.amountSatang / 100).toFixed(2)}</span>
      </div>
      <ul className="flex flex-col gap-1 text-ink-muted">
        {item.open.map((invoice) => (
          <li key={invoice.id} className="flex justify-between gap-3">
            <span className="tabular-nums">{invoice.number}</span>
            <span className="tabular-nums">{(invoice.outstanding / 100).toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <p className="text-ink-muted">{p.shortcuts}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={p.approveAmount} locale={locale}>
          <Input value={approveBaht} inputMode="decimal" onChange={(e) => setApproveBaht(e.target.value)} />
        </Field>
        <Button type="button" variant="primary" locale={locale} loading={busy === 'approve'} onClick={() => void approve()}>
          {p.approve}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={p.reason} locale={locale}>
          <Input ref={reasonRef} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Button type="button" variant="danger" locale={locale} loading={busy === 'reject'} disabled={reason.trim() === ''} onClick={reject}>
          {p.reject}
        </Button>
      </div>
    </section>
  );
}

/** Cash or transfer entered by the owner. Approved at once and settled the same way as a slip. */
export function ManualPaymentForm({
  locale,
  contracts,
}: {
  locale: Locale;
  contracts: { contractId: string; label: string }[];
}) {
  const { m } = translator(locale);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractId, setContractId] = useState(contracts[0]?.contractId ?? '');
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash');
  const p = m.payments.manual;

  if (contracts.length === 0) return <p className="text-ink-muted">{p.none}</p>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    const result = await recordManualPaymentNow({
      contractId,
      amountSatang: toSatang(String(data.get('amount') ?? '')),
      method,
      paidAt: new Date().toISOString(),
    });
    setSaving(false);
    if (!result.ok) {
      setError(failureText(m, result));
      return;
    }
    setError(null);
    event.currentTarget.reset();
    router.refresh();
  };

  return (
    <form onSubmit={submit} lang={locale} className="grid gap-4 md:grid-cols-2">
      <Field label={p.contract} locale={locale} required>
        <Select
          locale={locale}
          value={contractId}
          onValueChange={setContractId}
          options={contracts.map((c) => ({ value: c.contractId, label: c.label }))}
        />
      </Field>
      <Field label={p.amount} locale={locale} required>
        <Input name="amount" type="number" inputMode="decimal" min={0} step="0.01" required />
      </Field>
      <Field label={p.method} locale={locale} required>
        <Select
          locale={locale}
          value={method}
          onValueChange={(value) => setMethod(value === 'transfer' ? 'transfer' : 'cash')}
          options={[
            { value: 'cash', label: p.cash },
            { value: 'transfer', label: p.transfer },
          ]}
        />
      </Field>
      {error ? (
        <p role="alert" className={`${ts('body', locale)} text-danger md:col-span-2`}>
          {error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" variant="secondary" locale={locale} loading={saving}>
          {p.record}
        </Button>
      </div>
    </form>
  );
}

export function ReminderButton({ locale, invoiceId }: { locale: Locale; invoiceId: string }) {
  const { m } = translator(locale);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const send = async () => {
    setSaving(true);
    const result = await sendReminderNow({ invoiceId });
    setSaving(false);
    if (!result.ok) {
      toast({ title: failureText(m, result) });
      return;
    }
    router.refresh();
  };
  return (
    <Button type="button" variant="secondary" locale={locale} loading={saving} onClick={send}>
      {m.payments.overdue.remind}
    </Button>
  );
}
