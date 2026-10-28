'use client';

import { ResetDialog } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Fragment,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useStoreBoot } from '@/src/client-store/hooks';
import { getStore } from '@/src/client-store/instance';
import { useRole, writeRole } from '@/src/client-store/role';
import type { Role } from '@/src/client-store/schema';
import { translator } from '../i18n';
import { AccountMenu } from './nav/AccountMenu';
import { BottomTabs } from './nav/BottomTabs';
import { BuildingBadge } from './nav/BuildingBadge';
import { MoreSheet } from './nav/MoreSheet';
import {
  homePath,
  isNavActive,
  ROLE_NAV,
  type NavItem,
} from './nav/nav-config';
import { RegisterSW } from './pwa/RegisterSW';

const COLLAPSED_KEY = 'rentroll:nav-collapsed';
const COLLAPSED_EVENT = 'rentroll:nav-collapsed';
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

/** Runs of consecutive items that share a group, so the sidebar heads each group once. */
function groupRuns(items: NavItem[]) {
  const runs: { group: NavItem['group']; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = runs.at(-1);
    if (last && last.group === item.group) last.items.push(item);
    else runs.push({ group: item.group, items: [item] });
  }
  return runs;
}

/**
 * The app frame (ux-v2/rentroll.md › Shell, as Stockline v2): no demo bar and no footer. The building badge heads the
 * sidebar and the account menu sits at its foot (role, language, reset). An icon rail at 768–1023 and the full sidebar
 * from 1024 (grouped, collapsible); below 768 the badge tops the page and a bottom tab bar with "More" holds the rest.
 * Every section is reachable on a 390px screen for every role.
 */
export function AppShell({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  useStoreBoot();
  const role = useRole();
  const { m } = translator(locale);
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const { tabs, sections } = ROLE_NAV[role];
  const linkTo = (path: string) => `/${locale}${path}`;
  const moreSections = sections.filter((item) => !tabs.includes(item));

  // Switching the role is local: the choice is stored in this browser and the landing page follows it.
  function changeRole(next: string) {
    writeRole(next as Role);
    router.push(linkTo(homePath(next as Role)));
  }

  return (
    <div className="flex min-h-dvh flex-col">
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
            'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface-raised md:flex print:hidden',
            collapsed ? 'w-[4.5rem]' : 'w-[4.5rem] lg:w-60',
          )}
        >
          <BuildingBadge
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
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2"
          >
            {groupRuns(sections).map((run, index) => {
              // The full sidebar heads each group; the rail and the collapsed sidebar divide them with a rule.
              const headed = Boolean(run.group) && !collapsed;
              return (
                <Fragment key={run.group ?? `apart-${index}`}>
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className={cn(
                        'my-2 border-t border-line',
                        headed && 'lg:hidden',
                      )}
                    />
                  ) : null}
                  {headed && run.group ? (
                    <span
                      className={cn(
                        ts('label', locale),
                        'mb-1 hidden px-3 text-ink-muted lg:block',
                        index > 0 && 'mt-2',
                      )}
                    >
                      {m.nav.groups[run.group]}
                    </span>
                  ) : null}
                  {run.items.map((item) => (
                    <Link
                      prefetch={false}
                      key={item.key}
                      href={linkTo(item.path)}
                      aria-current={
                        isNavActive(item, pathname, locale) ? 'page' : undefined
                      }
                      aria-label={m.nav[item.key]}
                      title={m.nav[item.key]}
                      className={cn(
                        ts('ui', locale),
                        // 36 px rows from 1024 (pointer layouts) so all sections fit 1280 × 800; the rail keeps 40.
                        'group relative flex min-h-10 items-center gap-3 rounded-sm px-3 text-ink-muted hover:bg-surface-sunken hover:text-ink lg:min-h-9',
                        'aria-[current=page]:bg-product-accent-soft aria-[current=page]:text-product-accent',
                        collapsed
                          ? 'justify-center px-0'
                          : 'max-lg:justify-center max-lg:px-0',
                        focusRing,
                      )}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-1.5 left-0 hidden w-[3px] rounded-full bg-product-accent group-aria-[current=page]:block"
                      />
                      <item.icon
                        aria-hidden
                        size={20}
                        strokeWidth={1.75}
                        className="shrink-0"
                      />
                      {collapsed ? null : (
                        <span className="hidden lg:inline">
                          {m.nav[item.key]}
                        </span>
                      )}
                    </Link>
                  ))}
                </Fragment>
              );
            })}
          </nav>
          {/* The account and the collapse control share one row, so the whole menu fits 1280 × 800 unscrolled. */}
          <div
            className={cn(
              'flex flex-col gap-1 border-t border-line p-3',
              !collapsed && 'lg:flex-row lg:items-center',
            )}
          >
            <div className="min-w-0 flex-1">
              <AccountMenu
                locale={locale}
                role={role}
                compact={collapsed}
                onRoleChange={changeRole}
                onReset={() => setResetOpen(true)}
              />
            </div>
            <button
              type="button"
              onClick={() => writeCollapsed(!collapsed)}
              aria-label={collapsed ? m.nav.expand : m.nav.collapse}
              title={collapsed ? m.nav.expand : m.nav.collapse}
              aria-expanded={!collapsed}
              className={cn(
                'hidden size-10 shrink-0 items-center justify-center self-center rounded-sm text-ink-muted hover:bg-surface-sunken hover:text-ink lg:flex',
                focusRing,
              )}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden size={20} strokeWidth={1.75} />
              ) : (
                <PanelLeftClose aria-hidden size={20} strokeWidth={1.75} />
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
            className="mx-auto w-full max-w-[80rem] flex-1 px-4 pt-5 pb-28 outline-none md:px-8 md:pt-8 md:pb-8"
          >
            <BuildingBadge
              locale={locale}
              className="mb-5 md:hidden print:hidden"
            />
            {children}
          </main>
        </div>
      </div>

      <RegisterSW />
      <BottomTabs
        locale={locale}
        m={m}
        pathname={pathname}
        tabs={tabs}
        moreOpen={moreOpen}
        onMore={() => setMoreOpen(true)}
      />
      <MoreSheet
        locale={locale}
        m={m}
        pathname={pathname}
        sections={moreSections}
        open={moreOpen}
        onOpenChange={setMoreOpen}
        role={role}
        onRoleChange={changeRole}
        onReset={() => setResetOpen(true)}
      />
      <ResetDialog
        locale={locale}
        open={resetOpen}
        onOpenChange={setResetOpen}
        onReset={() => getStore().reset()}
      />
    </div>
  );
}
