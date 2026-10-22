'use client';

import { LocaleSwitch, type Locale } from '@peera/i18n';
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
import { ChevronDown, ExternalLink, Menu, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useEmbedded } from './demo-session';
import { kitStrings } from './strings';

export type DemoRole = { value: string; label: string };

/** The standalone URL for "open in new tab": same path and query, without `embed`, with the current language and theme. */
export function newTabHref(
  currentHref: string,
  locale: Locale,
  theme: 'light' | 'dark',
): string {
  const url = new URL(currentHref);
  url.searchParams.delete('embed');
  url.searchParams.set('lang', locale);
  url.searchParams.set('theme', theme);
  return url.toString();
}

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Shown only inside the website's iframe. Opens the demo first-party, where the camera and storage work. */
export function OpenInNewTab({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  const embedded = useEmbedded();
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    if (embedded)
      setHref(newTabHref(window.location.href, locale, currentTheme()));
  }, [embedded, locale]);
  if (!embedded || !href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      lang={locale}
      className={cn(
        ts('ui', locale),
        'inline-flex min-h-11 items-center gap-1.5 rounded-sm px-3 text-ink hover:bg-surface-raised md:min-h-9',
        focusRing,
        className,
      )}
    >
      <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
      {kitStrings[locale].openInNewTab}
    </a>
  );
}

export type ResetDialogProps = {
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => Promise<void> | void;
  /** Runs after a successful reset; defaults to reloading the page so every view shows the fresh data. */
  onDone?: () => void;
};

/** Asks before throwing the visitor's changes away. */
export function ResetDialog({
  locale,
  open,
  onOpenChange,
  onReset,
  onDone,
}: ResetDialogProps) {
  const strings = kitStrings[locale];
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onReset();
      onOpenChange(false);
      (onDone ?? (() => window.location.reload()))();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent locale={locale}>
        <DialogTitle locale={locale}>{strings.resetTitle}</DialogTitle>
        <DialogDescription locale={locale}>
          {strings.resetBody}
        </DialogDescription>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <DialogClose asChild>
            <Button locale={locale} variant="ghost">
              {strings.cancel}
            </Button>
          </DialogClose>
          <Button
            locale={locale}
            variant="danger"
            loading={busy}
            onClick={confirm}
          >
            {strings.resetConfirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type DemoBarProps = {
  productName: string;
  locale: Locale;
  roles: DemoRole[];
  role: string;
  /** Writes the role to the demo session (no password), e.g. a Server Action calling `setSessionRole`. */
  onRoleChange: (role: string) => Promise<void> | void;
  /** Resets the visitor's tenant, e.g. a Server Action calling `resetDemoTenant`. */
  onReset: () => Promise<void> | void;
  onResetDone?: () => void;
  className?: string;
};

/**
 * Slim bar above every demo (platform §6.4): product name, "sample data", role switcher, language, reset and
 * "open in new tab". Below 768px the role, reset and new-tab controls fold into one menu.
 */
export function DemoBar({
  productName,
  locale,
  roles,
  role,
  onRoleChange,
  onReset,
  onResetDone,
  className,
}: DemoBarProps) {
  const strings = kitStrings[locale];
  const [resetOpen, setResetOpen] = useState(false);
  const embedded = useEmbedded();
  const roleLabel = roles.find((item) => item.value === role)?.label ?? role;

  const roleItems = (
    <DropdownMenuRadioGroup
      value={role}
      onValueChange={(value) => void onRoleChange(value)}
    >
      {roles.map((item) => (
        <DropdownMenuRadioItem
          key={item.value}
          value={item.value}
          locale={locale}
        >
          {item.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  return (
    <aside
      lang={locale}
      aria-label={strings.demoMenu}
      className={cn(
        ts('ui', locale),
        'flex min-h-11 items-center gap-2 border-b border-line bg-surface-sunken px-3 text-ink md:min-h-10',
        className,
      )}
    >
      <span className="truncate font-medium">{productName}</span>
      <Badge locale={locale}>{strings.sampleData}</Badge>

      <div className="ml-auto hidden items-center gap-1 md:flex">
        <DropdownMenu>
          <DropdownMenuTrigger
            locale={locale}
            className="inline-flex items-center gap-1 px-3 hover:bg-surface-raised md:min-h-9"
          >
            {`${strings.role}: ${roleLabel}`}
            <ChevronDown aria-hidden size={16} strokeWidth={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuContent locale={locale} align="end">
            {roleItems}
          </DropdownMenuContent>
        </DropdownMenu>
        <LocaleSwitch />
        <Button
          locale={locale}
          variant="ghost"
          size="sm"
          onClick={() => setResetOpen(true)}
        >
          <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
          {strings.reset}
        </Button>
        <OpenInNewTab locale={locale} />
      </div>

      <div className="ml-auto flex items-center gap-1 md:hidden">
        <LocaleSwitch />
        <DropdownMenu>
          <DropdownMenuTrigger
            locale={locale}
            aria-label={strings.demoMenu}
            className="inline-flex min-w-11 items-center justify-center hover:bg-surface-raised"
          >
            <Menu aria-hidden size={20} strokeWidth={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuContent locale={locale} align="end">
            <DropdownMenuLabel locale={locale}>
              {strings.role}
            </DropdownMenuLabel>
            {roleItems}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              locale={locale}
              onSelect={() => setResetOpen(true)}
            >
              {strings.reset}
            </DropdownMenuItem>
            {embedded ? (
              <DropdownMenuItem
                locale={locale}
                onSelect={() =>
                  window.open(
                    newTabHref(window.location.href, locale, currentTheme()),
                    '_blank',
                    'noopener',
                  )
                }
              >
                {strings.openInNewTab}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ResetDialog
        locale={locale}
        open={resetOpen}
        onOpenChange={setResetOpen}
        onReset={onReset}
        onDone={onResetDone}
      />
    </aside>
  );
}
