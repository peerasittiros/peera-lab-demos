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
import { ChevronsUpDown, ExternalLink, RotateCcw } from 'lucide-react';
import { useStoreState } from '../client-store/hooks';
import type { Role } from '../domain/stock';
import { translator } from '../i18n';

/**
 * The signed-in person at the foot of the sidebar, as a real app has it. The demo's controls live in its menu
 * instead of a bar over the app: switching user is the role switch, then the language, then a small demo section
 * (sample data, reset, open in a new tab when framed by the website). Phones have the same controls in "More".
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
  const { m } = translator(locale);
  const kit = kitStrings[locale];
  const embedded = useEmbedded();
  const { ledger } = useStoreState();
  const nameOf = (who: Role) => ledger?.users[who]?.displayName ?? m.roles[who];
  const name = nameOf(role);

  const switchLocale = (next: string) => {
    if (next !== locale) window.location.assign(localeSwitchHref(window.location.href, next as Locale));
  };
  const openInNewTab = () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    window.open(newTabHref(window.location.href, locale, theme), '_blank', 'noopener');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        locale={locale}
        aria-label={`${m.account.menu}: ${name}, ${m.roles[role]}`}
        title={compact ? `${name} · ${m.roles[role]}` : undefined}
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
            'flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary-soft font-semibold text-primary',
          )}
        >
          {name.trim().charAt(0)}
        </span>
        {compact ? null : (
          <>
            <span className="hidden min-w-0 flex-1 lg:grid">
              <span className={cn(ts('ui', locale), 'truncate font-medium text-ink')}>{name}</span>
              <span className={cn(ts('body-sm', locale), 'truncate text-ink-muted')}>{m.roles[role]}</span>
            </span>
            <ChevronsUpDown aria-hidden size={16} strokeWidth={1.75} className="hidden shrink-0 text-ink-muted lg:block" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent locale={locale} side="top" align="start" className="min-w-64">
        <DropdownMenuLabel locale={locale}>{m.account.switchUser}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={role} onValueChange={onRoleChange}>
          {(['owner', 'staff'] as const).map((who) => (
            <DropdownMenuRadioItem key={who} value={who} locale={locale}>
              {`${nameOf(who)} · ${m.roles[who]}`}
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
