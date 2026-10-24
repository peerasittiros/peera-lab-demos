'use client';

import { LineChatMock, type ChatMessage } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import {
  Button,
  cn,
  focusRing,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  toast,
} from '@peera/ui';
import { useState } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import { actSendReminder } from '@/src/client-store/commands/property';
import { overdueList } from '@/src/client-store/selectors/overdue';
import type { StoreState } from '@/src/client-store/store';
import { translator, type Messages } from '@/src/i18n';
import { ReadyGate } from './ReadyGate';
import { KV } from './KV';

const overdueView = (s: StoreState) =>
  s.snapshotDate ? overdueList(s.data, s.ops, s.snapshotDate, new Date()) : [];

/**
 * Overdue invoices (SPEC §4 O13): days late, the late fee so far, and a reminder for each. A reminder is recorded and
 * shows in the tenant's chat preview (O14); nothing is sent anywhere.
 */
export function OverdueLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <OverdueBody locale={locale} />
    </ReadyGate>
  );
}

function OverdueBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.payments.overdue;
  const rows = useStore(overdueView);
  const role = useRole();
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const preview = rows.find((r) => r.id === previewFor) ?? null;

  if (rows.length === 0) return <p className="text-ink-muted">{p.empty}</p>;
  return (
    <>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li
            key={r.id}
            className="grid gap-x-4 gap-y-2 border-b border-line px-3 py-3 odd:bg-surface-sunken md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
          >
            <span className="tabular-nums text-ink">
              {r.roomNumber}
              {r.renterName ? (
                <span className="ml-2 text-ink-muted">{r.renterName}</span>
              ) : null}
            </span>
            <span className="tabular-nums text-ink-muted">
              <KV label={p.days}>{r.daysLate}</KV>
            </span>
            <span className="tabular-nums text-ink">
              <KV label={p.outstanding}>
                {formatMoney(r.outstandingSatang, locale)}
              </KV>
            </span>
            <span className="tabular-nums text-ink-muted">
              <KV label={p.lateFee}>{formatMoney(r.lateFeeSatang, locale)}</KV>
            </span>
            <span className="flex flex-wrap gap-2">
              <ReminderButton
                locale={locale}
                m={m}
                invoiceId={r.id}
                disabled={role !== 'owner'}
              />
              <button
                type="button"
                onClick={() => setPreviewFor(r.id)}
                className={cn(
                  'min-h-11 rounded-sm px-2 text-ink underline-offset-4 hover:underline',
                  focusRing,
                )}
              >
                {m.ownerLive.previewChat}
              </button>
            </span>
          </li>
        ))}
      </ul>
      <Sheet
        open={preview !== null}
        onOpenChange={(open) => !open && setPreviewFor(null)}
      >
        <SheetContent locale={locale}>
          <SheetTitle locale={locale}>{m.ownerLive.previewChat}</SheetTitle>
          <SheetDescription locale={locale} className="sr-only">
            {p.history}
          </SheetDescription>
          {preview ? (
            <ChatPreview
              locale={locale}
              renterName={preview.renterName}
              number={preview.number}
              daysLate={preview.daysLate}
              outstandingSatang={preview.outstandingSatang}
              reminders={preview.reminders.length}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ReminderButton({
  locale,
  m,
  invoiceId,
  disabled,
}: {
  locale: Locale;
  m: Messages;
  invoiceId: string;
  disabled: boolean;
}) {
  const role = useRole();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      locale={locale}
      disabled={disabled || busy}
      onClick={() => {
        setBusy(true);
        const result = actSendReminder(
          { store: getStore(), role, now: () => new Date() },
          { invoiceId },
        );
        setBusy(false);
        toast({
          title: result.ok
            ? m.ownerLive.reminderSent
            : m.payments.errors.notOverdue,
        });
      }}
    >
      {m.payments.overdue.remind}
    </Button>
  );
}

/** The reminder as the tenant's chat would show it (O14). Nothing is sent: this is the preview of the record. */
function ChatPreview({
  locale,
  renterName,
  number,
  daysLate,
  outstandingSatang,
  reminders,
}: {
  locale: Locale;
  renterName: string | null;
  number: string;
  daysLate: number;
  outstandingSatang: number;
  reminders: number;
}) {
  const { m } = translator(locale);
  const chat: ChatMessage[] = [
    {
      id: 'reminder',
      from: 'shop',
      at: new Date().toISOString(),
      card: {
        title: m.tenant.live.reminderTitle,
        rows: [
          [m.tenant.live.billNumber, number],
          [m.tenant.live.reminderDays, String(daysLate)],
          [m.tenant.live.billTotal, formatMoney(outstandingSatang, locale)],
        ],
      },
    },
  ];
  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-ink-muted">{renterName ?? ''}</p>
      <p className="text-ink-muted">
        <KV label={m.ownerLive.remindersSent}>
          <span className="tabular-nums">{reminders}</span>
        </KV>
      </p>
      <LineChatMock locale={locale} shopName={m.app.name} messages={chat} />
    </div>
  );
}
