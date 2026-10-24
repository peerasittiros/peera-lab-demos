'use client';

import { LineChatMock, type ChatMessage } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import {
  Button,
  focusRing,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  cn,
  ts,
} from '@peera/ui';
import { useState } from 'react';
import { useStore } from '@/src/client-store/hooks';
import type { TenantMessage } from '@/src/client-store/selectors/live';
import { translator } from '@/src/i18n';
import { TenantHome } from '@/src/components/tenant/TenantViews';
import { ReadyGate } from './ReadyGate';
import { InstallButton } from '@/src/components/pwa/InstallButton';
import { buildingView, homeView, messagesView } from './views';

/** The tenant's home, read from the browser store, with the chat of bills, receipts and notices. */
export function TenantHomeLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <TenantHomeBody locale={locale} />
    </ReadyGate>
  );
}

function TenantHomeBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.tenant.live;
  const home = useStore(homeView);
  const messages = useStore(messagesView);
  const building = useStore(buildingView);
  const [open, setOpen] = useState(false);
  const shopName = building
    ? locale === 'th'
      ? building.nameTh
      : (building.nameEn ?? building.nameTh)
    : '';

  return (
    <>
      <TenantHome locale={locale} home={home} />
      {home ? (
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            locale={locale}
            onClick={() => setOpen(true)}
          >
            {p.messages}
          </Button>
        </div>
      ) : null}

      <div className="mt-4">
        <InstallButton locale={locale} />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent locale={locale}>
          <SheetTitle locale={locale}>{p.messagesTitle}</SheetTitle>
          <SheetDescription locale={locale} className="sr-only">
            {p.messagesTitle}
          </SheetDescription>
          <div className="mt-4">
            {messages.length === 0 ? (
              <p className={cn(ts('body', locale), 'text-ink-muted')}>
                {p.noMessages}
              </p>
            ) : (
              <LineChatMock
                locale={locale}
                shopName={shopName}
                messages={toChat(messages, locale, m)}
              />
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              locale={locale}
              className={focusRing}
              onClick={() => setOpen(false)}
            >
              {m.common.back}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** The tenant's messages as the chat preview shows them. Nothing is sent: these come from the visitor's data. */
function toChat(
  messages: TenantMessage[],
  locale: Locale,
  m: ReturnType<typeof translator>['m'],
): ChatMessage[] {
  const p = m.tenant.live;
  return messages.map((message): ChatMessage => {
    switch (message.kind) {
      case 'bill':
        return {
          id: message.id,
          from: 'shop',
          at: message.at,
          card: {
            title: p.billTitle,
            rows: [
              [p.billNumber, message.number],
              [p.billTotal, formatMoney(message.totalSatang, locale)],
              [p.billDue, message.dueDate],
            ],
          },
        };
      case 'receipt':
        return {
          id: message.id,
          from: 'shop',
          at: message.at,
          card: {
            title: p.receiptTitle,
            rows: [
              [p.receiptNumber, message.receiptNumber],
              [p.receiptAmount, formatMoney(message.amountSatang, locale)],
            ],
          },
        };
      case 'reminder':
        return {
          id: message.id,
          from: 'shop',
          at: message.at,
          card: {
            title: p.reminderTitle,
            rows: [
              [p.billNumber, message.number],
              [p.reminderDays, String(message.daysOverdue)],
              [p.billTotal, formatMoney(message.outstandingSatang, locale)],
            ],
          },
        };
      case 'announcement':
        return {
          id: message.id,
          from: 'shop',
          at: message.at,
          text: `${locale === 'th' ? message.titleTh : message.titleEn}\n${locale === 'th' ? message.bodyTh : message.bodyEn}`,
        };
    }
  });
}
