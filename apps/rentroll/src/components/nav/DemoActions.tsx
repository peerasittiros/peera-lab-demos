'use client';

import type { Locale } from '@peera/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
  focusRing,
  ts,
} from '@peera/ui';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { writeRole } from '@/src/client-store/role';
import type { Messages } from '@/messages';

/**
 * The demo actions menu, next to the DemoBar (SPEC §4). "Open tenant A-305" switches to the tenant role and opens the
 * portal. The three simulations depend on the screens built in R4–R6 and stay disabled until then.
 */
export function DemoActions({ locale, m }: { locale: Locale; m: Messages }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function openTenant() {
    setBusy(true);
    try {
      writeRole('tenant');
      router.push(`/${locale}/t`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        locale={locale}
        disabled={busy}
        className={cn(
          ts('ui', locale),
          'inline-flex min-h-11 shrink-0 items-center gap-1 border-l border-line px-3 text-ink hover:bg-surface-raised md:min-h-9',
          focusRing,
        )}
      >
        {m.nav.demoActions}
        <ChevronDown aria-hidden size={16} strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent locale={locale} align="end">
        <DropdownMenuLabel locale={locale}>
          {m.nav.demoActions}
        </DropdownMenuLabel>
        <DropdownMenuItem locale={locale} disabled>
          {m.nav.simulateReminders}
        </DropdownMenuItem>
        <DropdownMenuItem locale={locale} disabled>
          {m.nav.simulateSendAll}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem locale={locale} onSelect={() => void openTenant()}>
          {m.nav.openTenant}
        </DropdownMenuItem>
        <DropdownMenuItem locale={locale} disabled>
          {m.nav.showReceived}
        </DropdownMenuItem>
        <DropdownMenuLabel
          locale={locale}
          className="font-normal text-ink-muted"
        >
          {m.nav.demoActionsSoon}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
