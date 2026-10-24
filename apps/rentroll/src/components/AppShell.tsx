'use client';

import { DemoBar, SampleDataNotice, ContactLink } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useRole, writeRole } from '@/src/client-store/role';
import type { Role } from '@/src/client-store/schema';
import { translator } from '../i18n';
import { BottomTabs } from './nav/BottomTabs';
import { DemoActions } from './nav/DemoActions';
import { MoreSheet } from './nav/MoreSheet';
import { isNavActive, ROLE_NAV } from './nav/nav-config';
import { RegisterSW } from './pwa/RegisterSW';

/**
 * The app frame (SPEC §3): the demo bar with its actions menu on top; a sidebar from 1024px; a bottom tab bar with
 * "More" below that. Every section is reachable on a 390px screen for every role.
 */
export function AppShell({
  locale,
  siteUrl,
  children,
}: {
  locale: Locale;
  siteUrl: string;
  children: ReactNode;
}) {
  const role = useRole();
  const { m } = translator(locale);
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { tabs, sections } = ROLE_NAV[role];
  const linkTo = (path: string) => `/${locale}${path}`;
  const moreSections = sections.filter((item) => !tabs.includes(item));

  function changeRole(next: string) {
    writeRole(next as Role);
    router.push(linkTo(next === 'tenant' ? '/t' : '/owner/dashboard'));
  }

  async function reset() {
    await getStore().reset();
    window.location.reload();
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
      <div className="sticky top-0 z-30 flex print:hidden">
        <DemoBar
          productName={m.app.name}
          locale={locale}
          roles={[
            { value: 'owner', label: m.roles.owner },
            { value: 'caretaker', label: m.roles.caretaker },
            { value: 'tenant', label: m.roles.tenant },
          ]}
          role={role}
          onRoleChange={changeRole}
          onReset={reset}
          className="min-w-0 flex-1"
        />
        <DemoActions locale={locale} m={m} />
      </div>
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'sticky top-11 hidden h-[calc(100dvh-2.75rem)] shrink-0 flex-col border-r border-line bg-surface-raised lg:flex print:hidden',
            collapsed ? 'w-[4.5rem]' : 'w-60',
          )}
        >
          <nav
            aria-label={m.nav.label}
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
          >
            {sections.map((item) => (
              <Link
                prefetch={false}
                key={item.key}
                href={linkTo(item.path)}
                aria-current={
                  isNavActive(item, pathname, locale) ? 'page' : undefined
                }
                aria-label={collapsed ? m.nav[item.key] : undefined}
                title={collapsed ? m.nav[item.key] : undefined}
                className={cn(
                  ts('ui', locale),
                  'flex min-h-11 items-center gap-3 rounded-sm px-3 text-ink-muted hover:bg-surface-sunken hover:text-ink',
                  'aria-[current=page]:bg-product-accent-soft aria-[current=page]:text-product-accent aria-[current=page]:shadow-[inset_3px_0_0_var(--product-accent)]',
                  collapsed && 'justify-center px-0',
                  focusRing,
                )}
              >
                <item.icon
                  aria-hidden
                  size={20}
                  strokeWidth={1.75}
                  className="shrink-0"
                />
                {collapsed ? null : <span>{m.nav[item.key]}</span>}
              </Link>
            ))}
          </nav>
          <div className="border-t border-line p-3">
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? m.nav.expand : m.nav.collapse}
              aria-expanded={!collapsed}
              className={cn(
                'flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-ink-muted hover:bg-surface-sunken hover:text-ink',
                collapsed && 'justify-center px-0',
                focusRing,
              )}
            >
              <span className={ts('ui', locale)}>
                {collapsed ? m.nav.expand : m.nav.collapse}
              </span>
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[80rem] flex-1 px-4 pt-5 pb-28 outline-none md:px-8 md:pt-8 lg:pb-8"
          >
            {children}
          </main>
          <footer className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line px-4 pt-3 pb-28 md:px-8 lg:pb-6 print:hidden">
            <SampleDataNotice locale={locale} />
            <ContactLink locale={locale} siteUrl={siteUrl} />
          </footer>
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
      />
    </div>
  );
}
