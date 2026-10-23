'use client';

import { DemoBar, SampleDataNotice, ContactLink } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';
import {
  Building2,
  CalendarClock,
  CreditCard,
  Gauge,
  Home,
  Megaphone,
  Receipt,
  Settings,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { resetDemo, switchRole } from '../actions/demo';
import { translator } from '../i18n';

type Role = 'owner' | 'caretaker' | 'tenant';

type NavKey =
  | 'dashboard'
  | 'rooms'
  | 'tenants'
  | 'contracts'
  | 'meters'
  | 'billing'
  | 'invoices'
  | 'payments'
  | 'overdue'
  | 'repairs'
  | 'announcements'
  | 'reports'
  | 'settings'
  | 'bills'
  | 'myRepairs';

/** Owner and caretaker menu (01 §6.1). Tenants get the portal entries instead. */
const OWNER_NAV: { key: NavKey; path: string; icon: LucideIcon }[] = [
  { key: 'dashboard', path: '/owner/dashboard', icon: Home },
  { key: 'rooms', path: '/owner/rooms', icon: Building2 },
  { key: 'tenants', path: '/owner/tenants', icon: CalendarClock },
  { key: 'meters', path: '/owner/meters/current', icon: Gauge },
  { key: 'billing', path: '/owner/billing/current', icon: Receipt },
  { key: 'invoices', path: '/owner/invoices', icon: Receipt },
  { key: 'payments', path: '/owner/payments/review', icon: CreditCard },
  { key: 'overdue', path: '/owner/overdue', icon: CreditCard },
  { key: 'repairs', path: '/owner/repairs', icon: Wrench },
  { key: 'announcements', path: '/owner/announcements', icon: Megaphone },
  { key: 'reports', path: '/owner/reports/rent-roll', icon: Receipt },
  { key: 'settings', path: '/owner/settings/buildings', icon: Settings },
];

const TENANT_NAV: { key: NavKey; path: string; icon: LucideIcon }[] = [
  { key: 'bills', path: '/t/bills', icon: Receipt },
  { key: 'myRepairs', path: '/t/repairs', icon: Wrench },
];

export function AppShell({
  locale,
  role,
  siteUrl,
  children,
}: {
  locale: Locale;
  role: Role;
  siteUrl: string;
  children: ReactNode;
}) {
  const { m } = translator(locale);
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const entries = role === 'tenant' ? TENANT_NAV : OWNER_NAV;
  const linkTo = (path: string) => `/${locale}${path}`;
  const isActive = (path: string) => pathname.startsWith(linkTo(path));

  async function changeRole(next: string) {
    const { landing } = await switchRole({ role: next as Role });
    router.push(linkTo(landing));
    router.refresh();
  }

  async function reset() {
    await resetDemo();
    router.refresh();
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
        className="sticky top-0 z-30 print:hidden"
      />
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
            {entries.map(({ key, path, icon: Icon }) => (
              <Link
                prefetch={false}
                key={key}
                href={linkTo(path)}
                aria-current={isActive(path) ? 'page' : undefined}
                aria-label={collapsed ? m.nav[key] : undefined}
                title={collapsed ? m.nav[key] : undefined}
                className={cn(
                  ts('ui', locale),
                  'flex min-h-10 items-center gap-3 rounded-sm px-3 text-ink-muted hover:bg-surface-sunken hover:text-ink',
                  'aria-[current=page]:bg-product-accent-soft aria-[current=page]:text-ink',
                  collapsed && 'justify-center px-0',
                  focusRing,
                )}
              >
                <Icon aria-hidden size={20} strokeWidth={1.75} className="shrink-0" />
                {collapsed ? null : <span>{m.nav[key]}</span>}
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
                'flex min-h-10 w-full items-center gap-3 rounded-sm px-3 text-ink-muted hover:bg-surface-sunken hover:text-ink',
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
            className="mx-auto w-full max-w-[80rem] flex-1 px-4 pt-5 pb-8 outline-none md:px-8 md:pt-8"
          >
            {children}
          </main>
          <footer className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line px-4 pt-3 pb-6 md:px-8 print:hidden">
            <SampleDataNotice locale={locale} />
            <ContactLink locale={locale} siteUrl={siteUrl} />
          </footer>
        </div>
      </div>
    </div>
  );
}
