'use client';

import type { Locale } from '@peera/i18n';
import { Button, Checkbox, toast, ts } from '@peera/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { generateBillingRun, sendBillingRun, voidInvoice } from '../../actions/billing';
import { translator, type Messages } from '../../i18n';

type Missing = { roomId: string; roomNumber: string; electricity: boolean; water: boolean };

function failureText(m: Messages, messageKey: string): string {
  const key = messageKey.split('.').pop() as keyof Messages['billing']['errors'];
  return m.billing.errors[key] ?? m.billing.errors.saveFailed;
}

/** Step 1 (meters) and the generate, send and void actions for one building and month. */
export function BillingRun({
  locale,
  buildingId,
  period,
  missing,
  drafts,
  hasPlan,
  canGenerate,
  invoices,
}: {
  locale: Locale;
  buildingId: string;
  period: string;
  missing: Missing[];
  drafts: number;
  hasPlan: boolean;
  canGenerate: boolean;
  invoices: { id: string; number: string; roomNumber: string; status: string; totalSatang: number }[];
}) {
  const { m } = translator(locale);
  const router = useRouter();
  const [estimates, setEstimates] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const p = m.billing;
  const unresolved = missing.some((room) => !estimates.has(room.roomId));

  const toggle = (roomId: string, checked: boolean) =>
    setEstimates((current) => {
      const next = new Set(current);
      if (checked) next.add(roomId);
      else next.delete(roomId);
      return next;
    });

  const run = async (label: string, action: () => Promise<{ ok: boolean; error?: { messageKey: string } }>) => {
    setBusy(label);
    const result = await action();
    setBusy(null);
    if (!result.ok) {
      toast({ title: failureText(m, result.error?.messageKey ?? '') });
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      {missing.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4 md:p-5" lang={locale}>
          <h2 className={`${ts('title', locale)} text-ink`}>{p.missingTitle}</h2>
          <p className="text-ink-muted">{p.missingBody}</p>
          <ul className="flex flex-col gap-2">
            {missing.map((room) => (
              <li key={room.roomId} className="flex flex-wrap items-center justify-between gap-3">
                <span className="tabular-nums text-ink">{room.roomNumber}</span>
                <Checkbox
                  locale={locale}
                  label={`${p.estimate} · ${p.estimateHint}`}
                  checked={estimates.has(room.roomId)}
                  onCheckedChange={(checked) => toggle(room.roomId, checked === true)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canGenerate && hasPlan ? (
          <Button
            type="button"
            variant="primary"
            locale={locale}
            disabled={unresolved || busy !== null}
            loading={busy === 'generate'}
            onClick={() =>
              run('generate', () =>
                generateBillingRun({ buildingId, period, estimateRoomIds: [...estimates] }),
              )
            }
          >
            {p.generate}
          </Button>
        ) : null}
        {drafts > 0 ? (
          <Button
            type="button"
            variant="secondary"
            locale={locale}
            loading={busy === 'send'}
            disabled={busy !== null}
            onClick={() => run('send', () => sendBillingRun({ buildingId, period }))}
          >
            {p.send}
          </Button>
        ) : null}
      </div>

      {invoices.some((i) => i.status === 'draft') ? (
        <ul className="flex flex-col gap-2">
          {invoices
            .filter((i) => i.status === 'draft')
            .map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line p-3">
                <span className="tabular-nums text-ink">
                  <span>{i.roomNumber}</span> <span>{i.number}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  locale={locale}
                  disabled={busy !== null}
                  onClick={() => run(`void-${i.id}`, () => voidInvoice({ invoiceId: i.id }))}
                >
                  {p.void}
                </Button>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
