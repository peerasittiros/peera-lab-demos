'use client';

import { useRole, useRoleControl } from '../client-store/role';
import {
  CoachMarks,
  kitStrings,
  newTabHref,
  ResetDialog,
  useDemoHref,
  useEmbedded,
} from '@peera/demo-kit';
import { LocaleSwitch, type Locale } from '@peera/i18n';
import {
  Button,
  cn,
  ErrorState,
  focusRing,
  SegmentedControl,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  ts,
} from '@peera/ui';
import {
  ArrowLeftRight,
  ClipboardCheck,
  ClipboardList,
  Ellipsis,
  ExternalLink,
  FileUp,
  History,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useStoreInstance, useStoreState } from '../client-store/hooks';
import { translator } from '../i18n';
import { AccountMenu } from './AccountMenu';
import { ShopBadge } from './ShopBadge';
import { ThemeSwitch } from './ThemeSwitch';

type NavKey =
  | 'quickMove'
  | 'dashboard'
  | 'items'
  | 'reorder'
  | 'orders'
  | 'counts'
  | 'history'
  | 'import'
  | 'suppliers'
  | 'settings';

const NAV: { key: NavKey; path: string; icon: LucideIcon; owner?: true }[] = [
  { key: 'quickMove', path: '', icon: ArrowLeftRight },
  { key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, owner: true },
  { key: 'items', path: '/items', icon: Package },
  { key: 'reorder', path: '/reorder', icon: ShoppingCart },
  { key: 'orders', path: '/orders', icon: ClipboardList },
  { key: 'counts', path: '/counts', icon: ClipboardCheck },
  { key: 'history', path: '/history', icon: History },
  { key: 'import', path: '/import', icon: FileUp, owner: true },
  { key: 'suppliers', path: '/suppliers', icon: Truck, owner: true },
  { key: 'settings', path: '/settings', icon: Settings, owner: true },
];

/** The phone tab bar holds at most five entries (platform §5.4); the rest sit behind "More". */
const TABS: NavKey[] = ['quickMove', 'items', 'reorder', 'history'];

const COLLAPSED_KEY = 'stockline:nav-collapsed';
const COLLAPSED_EVENT = 'stockline:nav-collapsed';
let collapsedFallback = false;

// The collapsed sidebar is a per-browser convenience (localStorage, with an in-memory fallback when blocked).
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return collapsedFallback;
  }
}

function writeCollapsed(value: boolean) {
  collapsedFallback = value;
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    // Not remembered across visits; fine.
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSED_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function AppShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const role = useRole();
  const { m } = translator(locale);
  const router = useRouter();
  const pathname = usePathname();
  const href = useDemoHref();
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const store = useStoreInstance();
  const { status: storeStatus, ledger, variant } = useStoreState();
  const storeFailed = storeStatus === 'error' && !ledger;
  const embedded = useEmbedded();

  const toggleCollapsed = () => writeCollapsed(!collapsed);

  const entries = NAV.filter((entry) => !entry.owner || role === 'owner');
  const base = `/${locale}`;
  const isActive = (path: string) =>
    path === ''
      ? pathname === base || pathname === `${base}/`
      : pathname === `${base}${path}` || pathname.startsWith(`${base}${path}/`);
  const linkTo = (path: string) => href(`${base}${path}`);
  const moreEntries = entries.filter((entry) => !TABS.includes(entry.key));
  const moreActive = moreEntries.some((entry) => isActive(entry.path));

  const roleControl = useRoleControl();
  // Switching the role is local: the choice is stored in this browser and the landing page follows it.
  const changeRole = (next: string) => {
    if (next !== 'owner' && next !== 'staff') return;
    roleControl.setRole(next);
    router.push(linkTo(next === 'owner' ? '/dashboard' : ''));
  };

  // Reset clears this browser's copy of the shop; the template is loaded again from the snapshot.
  const reset = async () => {
    await store?.reset();
  };

  return (
    <div lang={locale} className="flex min-h-dvh flex-col bg-surface text-ink md:bg-surface-tint">
      <a
        href="#main"
        className={cn(
          ts('ui', locale),
          'sr-only z-50 rounded-sm bg-surface-raised px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2',
          focusRing,
        )}
      >
        {m.nav.skip}
      </a>
      {/* No demo bar over the app: the demo's controls are in the account menu (sidebar) and "More" (phones). */}
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            // An icon rail at 768–1023, the full sidebar from 1024 (collapsible there).
            'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface-raised md:flex print:hidden',
            collapsed ? 'w-[4.5rem]' : 'w-[4.5rem] lg:w-60',
          )}
        >
          <ShopBadge
            locale={locale}
            compact={collapsed}
            railBelowLg
            className={cn(
              'border-b border-line p-3',
              collapsed ? 'justify-center' : 'max-lg:justify-center',
            )}
          />
          <nav
            aria-label={m.nav.label}
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
          >
            {entries.map(({ key, path, icon: Icon }) => (
              <Link
                prefetch={false}
                key={key}
                href={linkTo(path)}
                aria-current={isActive(path) ? 'page' : undefined}
                aria-label={m.nav[key]}
                title={m.nav[key]}
                className={cn(
                  ts('ui', locale),
                  'group relative flex min-h-10 items-center gap-3 rounded-sm px-3 text-ink-muted hover:bg-surface-sunken hover:text-ink',
                  'aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary',
                  collapsed ? 'justify-center px-0' : 'max-lg:justify-center max-lg:px-0',
                  focusRing,
                )}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 left-0 hidden w-[3px] rounded-full bg-primary group-aria-[current=page]:block"
                />
                <Icon
                  aria-hidden
                  size={20}
                  strokeWidth={1.75}
                  className="shrink-0"
                />
                {collapsed ? null : <span className="hidden lg:inline">{m.nav[key]}</span>}
              </Link>
            ))}
          </nav>
          <div className="grid gap-1 border-t border-line p-3">
            <AccountMenu
              locale={locale}
              role={role}
              compact={collapsed}
              onRoleChange={changeRole}
              onReset={() => setResetOpen(true)}
            />
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? m.nav.expand : m.nav.collapse}
              aria-expanded={!collapsed}
              className={cn(
                'hidden min-h-10 w-full items-center gap-3 rounded-sm px-3 text-ink-muted hover:bg-surface-sunken hover:text-ink lg:flex',
                collapsed && 'justify-center px-0',
                focusRing,
              )}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden size={20} strokeWidth={1.75} />
              ) : (
                <>
                  <PanelLeftClose aria-hidden size={20} strokeWidth={1.75} />
                  <span className={ts('ui', locale)}>{m.nav.collapse}</span>
                </>
              )}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main
            id="main"
            tabIndex={-1}
            // No footer, as in a real app (the sample-data note and contact link were demo-only). On phones the bottom
            // padding keeps the last row clear of the tab bar.
            className="mx-auto w-full max-w-[80rem] flex-1 px-4 pt-5 pb-24 outline-none md:px-8 md:pt-8 md:pb-8"
          >
            <ShopBadge locale={locale} className="mb-5 md:hidden" />
            {/* The tour is a card in the flow, so it never covers a list row (ux-v2 §3). */}
            <CoachMarks
              locale={locale}
              storageKey="stockline"
              placement="inline"
              className="mb-6"
              steps={[
                { title: m.coach.step1Title, body: m.coach.step1Body },
                { title: m.coach.step2Title, body: m.coach.step2Body },
                { title: m.coach.step3Title, body: m.coach.step3Body },
              ]}
            />
            {storeFailed ? (
              <ErrorState
                locale={locale}
                title={m.common.loadError}
                description={m.common.loadErrorBody}
                retryLabel={m.common.retry}
                onRetry={() => {
                  if (store && variant) void store.load(variant);
                }}
              />
            ) : (
              children
            )}
          </main>
        </div>
      </div>

      <nav
        aria-label={m.nav.label}
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        {TABS.map((key) => {
          const entry = NAV.find((item) => item.key === key)!;
          const Icon = entry.icon;
          return (
            <Link
              prefetch={false}
              key={key}
              href={linkTo(entry.path)}
              aria-current={isActive(entry.path) ? 'page' : undefined}
              className={cn(
                ts('body-sm', locale),
                'flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-center font-medium text-ink-muted',
                'aria-[current=page]:text-primary',
                focusRing,
              )}
            >
              <Icon aria-hidden size={20} strokeWidth={1.75} />
              <span className="whitespace-nowrap leading-tight">
                {key === 'quickMove' ? m.nav.quickMoveTab : m.nav[key]}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          data-active={moreActive || undefined}
          className={cn(
            ts('body-sm', locale),
            'flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-center font-medium text-ink-muted',
            'data-[active]:text-primary',
            focusRing,
          )}
        >
          <Ellipsis aria-hidden size={20} strokeWidth={1.75} />
          <span className="whitespace-nowrap leading-tight">{m.nav.more}</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent locale={locale}>
          <SheetTitle locale={locale}>{m.nav.moreLabel}</SheetTitle>
          <SheetDescription locale={locale} className="sr-only">
            {m.nav.label}
          </SheetDescription>
          <nav aria-label={m.nav.moreLabel} className="mt-4 grid gap-1">
            {moreEntries.map(({ key, path, icon: Icon }) => (
              <Link
                prefetch={false}
                key={key}
                href={linkTo(path)}
                onClick={() => setMoreOpen(false)}
                aria-current={isActive(path) ? 'page' : undefined}
                className={cn(
                  ts('ui', locale),
                  'flex min-h-12 items-center gap-3 rounded-sm px-3 text-ink hover:bg-surface-sunken',
                  'aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary',
                  focusRing,
                )}
              >
                <Icon aria-hidden size={20} strokeWidth={1.75} />
                {m.nav[key]}
              </Link>
            ))}
          </nav>
          <section className="mt-6 grid gap-4 border-t border-line pt-4">
            <div className="grid gap-2">
              <span className={cn(ts('ui', locale), 'text-ink-muted')}>
                {m.nav.role}
              </span>
              <SegmentedControl
                locale={locale}
                fullWidth
                aria-label={m.nav.role}
                value={role}
                onValueChange={(next) => {
                  setMoreOpen(false);
                  changeRole(next);
                }}
                options={[
                  { value: 'owner', label: m.roles.owner },
                  { value: 'staff', label: m.roles.staff },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={cn(ts('ui', locale), 'text-ink-muted')}>
                {m.nav.language}
              </span>
              <LocaleSwitch />
            </div>
            <div className="grid gap-2">
              <span className={cn(ts('ui', locale), 'text-ink-muted')}>
                {m.nav.theme}
              </span>
              <ThemeSwitch
                locale={locale}
                options={{
                  light: m.nav.themeLight,
                  dark: m.nav.themeDark,
                  device: m.nav.themeDevice,
                }}
              />
            </div>
            <Button
              locale={locale}
              variant="ghost"
              className="justify-start"
              onClick={() => {
                setMoreOpen(false);
                setResetOpen(true);
              }}
            >
              <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
              {kitStrings[locale].reset}
            </Button>
            {embedded ? (
              <Button
                locale={locale}
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
                  window.open(newTabHref(window.location.href, locale, theme), '_blank', 'noopener');
                }}
              >
                <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
                {kitStrings[locale].openInNewTab}
              </Button>
            ) : null}
          </section>
        </SheetContent>
      </Sheet>

      <ResetDialog
        locale={locale}
        open={resetOpen}
        onOpenChange={setResetOpen}
        onReset={reset}
      />
    </div>
  );
}
