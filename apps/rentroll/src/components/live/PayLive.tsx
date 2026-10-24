'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { Button, cn, Field, Input, toast, ts } from '@peera/ui';
import { useCallback, useState, type FormEvent } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useRole } from '@/src/client-store/role';
import { useStore } from '@/src/client-store/hooks';
import type { StoreState } from '@/src/client-store/store';
import { actSubmitSlip } from '@/src/client-store/commands/payments';
import { loadPayInvoice } from '@/src/client-store/selectors/live';
import { downscaleSlip, rememberSlip } from '@/src/client-store/slip-images';
import type { SlipKind } from '@/src/client-store/ops';
import { PageHeader } from '@/src/components/PageHeader';
import { translator, type Messages } from '@/src/i18n';
import { ReadyGate } from './ReadyGate';

/** Pay screen (SPEC §4 T3): what is owed, a sample QR, and the slip. Reads and writes the browser store. */
export function PayLive({
  locale,
  invoiceId,
}: {
  locale: Locale;
  invoiceId: string;
}) {
  return (
    <ReadyGate locale={locale}>
      <PayBody locale={locale} invoiceId={invoiceId} />
    </ReadyGate>
  );
}

function PayBody({ locale, invoiceId }: { locale: Locale; invoiceId: string }) {
  const { m } = translator(locale);
  const p = m.payments.pay;
  const select = useCallback(
    (s: StoreState) => loadPayInvoice(s.data, invoiceId),
    [invoiceId],
  );
  const found = useStore(select);
  if (!found)
    return <p className="text-ink-muted">{m.tenant.live.billNotFound}</p>;

  const i = found.invoice;
  const payable = i.status === 'sent' || i.status === 'partially_paid';
  const building =
    locale === 'th'
      ? found.buildingNameTh
      : (found.buildingNameEn ?? found.buildingNameTh);
  return (
    <>
      <PageHeader
        locale={locale}
        title={p.title}
        description={`${building} · ${found.roomNumber}`}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          <p className="text-ink-muted">{p.owed}</p>
          <p className={cn(ts('headline-md', locale), 'tabular-nums text-ink')}>
            {formatMoney(found.outstandingSatang, locale)}
          </p>
          <p className="text-ink-muted">
            <span>{p.due}</span>{' '}
            <span className="tabular-nums">{i.dueDate}</span>
          </p>
          <p className="tabular-nums text-ink">{i.number}</p>
          <div className="flex flex-col gap-2 rounded-sm border border-dashed border-line-strong p-3">
            <span className="font-semibold text-ink">{p.sample}</span>
            <code className="break-all tabular-nums text-ink">{`RENTROLL-DEMO-${i.number}-${(found.outstandingSatang / 100).toFixed(2)}`}</code>
          </div>
        </section>
        <section className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          {found.pendingSlips > 0 ? (
            <p className="text-ink">{p.waiting}</p>
          ) : null}
          {payable && found.outstandingSatang > 0 ? (
            <SlipForm
              locale={locale}
              m={m}
              invoiceId={invoiceId}
              outstandingSatang={found.outstandingSatang}
            />
          ) : (
            <p className="text-ink">{p.paid}</p>
          )}
        </section>
      </div>
    </>
  );
}

/** Amount (defaults to the balance), the slip image (sample or upload), and the submit button. */
function SlipForm({
  locale,
  m,
  invoiceId,
  outstandingSatang,
}: {
  locale: Locale;
  m: Messages;
  invoiceId: string;
  outstandingSatang: number;
}) {
  const role = useRole();
  const p = m.payments.pay;
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [slip, setSlip] = useState<SlipKind>(null);
  const [file, setFile] = useState<File | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amountSatang = Math.round(
      Number(String(data.get('amount') ?? '').replace(/,/g, '')) * 100,
    );
    const kind: SlipKind = file ? 'uploaded' : slip;
    setSaving(true);
    const result = actSubmitSlip(
      { store: getStore(), role, now: () => new Date() },
      { invoiceId, amountSatang, slipUrl: kind },
    );
    if (result.ok && file) {
      const image = await downscaleSlip(file);
      if (image) rememberSlip(result.value.paymentId, image);
    }
    setSaving(false);
    if (!result.ok) {
      toast({ title: failureText(m, result.error) });
      return;
    }
    setSent(true);
  };

  if (sent)
    return <p className={cn(ts('body', locale), 'text-ink')}>{p.sent}</p>;
  return (
    <form onSubmit={submit} lang={locale} className="flex flex-col gap-4">
      <Field label={p.amount} locale={locale} required>
        <Input
          name="amount"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={(outstandingSatang / 100).toFixed(2)}
          required
        />
      </Field>
      <Field label={p.slip} hint={p.slipNote} locale={locale}>
        <input
          name="slip"
          type="file"
          accept="image/*"
          className="min-h-11 text-ink"
          onChange={(event) => {
            setFile(event.currentTarget.files?.[0] ?? null);
            setSlip(null);
          }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          locale={locale}
          onClick={() => {
            setSlip('sample');
            setFile(null);
          }}
        >
          {m.tenant.live.sampleSlip}
        </Button>
        {file ? (
          <span
            className={cn(
              locale === 'th' ? 'caption-th' : 'caption',
              'text-ink-muted',
            )}
          >
            {m.tenant.live.slipKept}
          </span>
        ) : null}
      </div>
      <div>
        <Button
          type="submit"
          variant="primary"
          locale={locale}
          loading={saving}
        >
          {p.submit}
        </Button>
      </div>
    </form>
  );
}

function failureText(m: Messages, key: string): string {
  const last = key.split('.').pop() as keyof Messages['payments']['errors'];
  return m.payments.errors[last] ?? m.payments.errors.saveFailed;
}
