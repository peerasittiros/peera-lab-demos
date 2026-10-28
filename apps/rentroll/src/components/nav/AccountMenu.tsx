'use client';

import { kitStrings, newTabHref, useEmbedded } from '@peera/demo-kit';
import { localeSwitchHref, type Locale } from '@peera/i18n';
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  focusRing,
  ts,
} from '@peera/ui';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { useStore } from '@/src/client-store/hooks';
import type { Role } from '@/src/client-store/schema';
import { demoTenantView } from '@/src/components/live/views';
import { translator } from '@/src/i18n';

const ROLES: Role[] = ['owner', 'caretaker', 'tenant'];

/**
 * The signed-in person at the foot of the sidebar, as a real app has it (ported from Stockline). The demo's controls
 * live in its menu instead of a bar over the app: switching user is the role switch (the tenant is the sample tenant
 * of room A-305), then the language, then a small demo section (reset, open in a new tab when framed by the website).
 * Phones have the same controls in "More".
 */
export function AccountMenu({
  locale,
  role,
  compact,
  onRoleChange,
  onReset,
}: {
  locale: Locale;
  role: Role;
  /** Icon rail or collapsed sidebar: the avatar only. */
  compact: boolean;
  onRoleChange: (role: string) => void;
  onReset: () => void;
}) {
  const { m, t } = translator(locale);
  const kit = kitStrings[locale];
  const embedded = useEmbedded();
  const tenant = useStore(demoTenantView);

  // Owner and caretaker are sample accounts; the tenant is the person on room A-305's contract.
  const nameOf = (who: Role) =>
    (who === 'tenant' && tenant?.renterName) || m.roles[who];
  const detailOf = (who: Role) =>
    who === 'tenant' && tenant
      ? t('account.tenantRoom', { room: tenant.roomNumber })
      : who === 'tenant'
        ? m.roles.tenant
        : m.account.sampleAccount;
  const name = nameOf(role);
  // The trigger is narrow: the tenant's line is just the room (the menu says "Tenant · room A-305").
  const detail =
    role === 'tenant' && tenant
      ? t('account.room', { room: tenant.roomNumber })
      : detailOf(role);

  const switchLocale = (next: string) => {
    if (next !== locale)
      window.location.assign(
        localeSwitchHref(window.location.href, next as Locale),
      );
  };
  const openInNewTab = () => {
    const theme =
      document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    window.open(
      newTabHref(window.location.href, locale, theme),
      '_blank',
      'noopener',
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        locale={locale}
        aria-label={`${m.account.menu}: ${name}, ${detail}`}
        title={`${name} · ${detail}`}
        className={cn(
          'flex min-h-12 w-full items-center gap-3 rounded-sm px-2 text-left hover:bg-surface-sunken',
          compact ? 'justify-center px-0' : 'max-lg:justify-center max-lg:px-0',
          focusRing,
        )}
      >
        <span
          aria-hidden
          className={cn(
            ts('ui', locale),
            'flex size-9 shrink-0 items-center justify-center rounded-sm bg-product-accent-soft font-semibold text-product-accent',
          )}
        >
          {name.trim().charAt(0)}
        </span>
        {compact ? null : (
          <span className="hidden min-w-0 flex-1 lg:grid">
            <span
              className={cn(ts('ui', locale), 'truncate font-medium text-ink')}
            >
              {name}
            </span>
            <span
              className={cn(ts('body-sm', locale), 'truncate text-ink-muted')}
            >
              {detail}
            </span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        locale={locale}
        side="top"
        align="start"
        className="min-w-64"
      >
        <DropdownMenuLabel locale={locale}>
          {m.account.switchUser}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={role} onValueChange={onRoleChange}>
          {ROLES.map((who) => (
            <DropdownMenuRadioItem key={who} value={who} locale={locale}>
              {who === 'tenant'
                ? `${nameOf(who)} · ${detailOf(who)}`
                : m.roles[who]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel locale={locale}>{m.nav.language}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={switchLocale}>
          <DropdownMenuRadioItem value="th" locale="th">
            {m.account.thai}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en" locale="en">
            {m.account.english}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel locale={locale}>{m.account.demo}</DropdownMenuLabel>
        <DropdownMenuItem locale={locale} onSelect={onReset}>
          <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
          {kit.reset}
        </DropdownMenuItem>
        {embedded ? (
          <DropdownMenuItem locale={locale} onSelect={openInNewTab}>
            <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
            {kit.openInNewTab}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
