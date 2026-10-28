'use client';

import { cn, focusRing } from '@peera/ui';
import type { Locale } from '@peera/i18n';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { isNavActive, type NavItem, type NavKey } from './nav-config';
import type { Messages } from '@/messages';

/**
 * The bottom tab bar below 768px (DESIGN.md §5): up to four items with icon and label, then "More". Safe-area padding
 * keeps it clear of the home indicator. Each item is at least 44px tall.
 */
export function BottomTabs({
  locale,
  m,
  pathname,
  tabs,
  moreOpen,
  onMore,
}: {
  locale: Locale;
  m: Messages;
  pathname: string;
  tabs: NavItem[];
  moreOpen: boolean;
  onMore: () => void;
}) {
  return (
    <nav
      aria-label={m.nav.label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised shadow-(--shadow-md) pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {tabs.map((item) => (
          <li key={item.key}>
            <TabLink
              locale={locale}
              label={m.nav[item.key as NavKey]}
              href={`/${locale}${item.path}`}
              active={isNavActive(item, pathname, locale)}
              Icon={item.icon}
            />
          </li>
        ))}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={onMore}
            className={cn(
              locale === 'th' ? 'caption-th' : 'caption',
              'flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 text-ink-muted',
              focusRing,
            )}
          >
            <Menu aria-hidden size={22} strokeWidth={1.75} />
            <span>{m.nav.more}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function TabLink({
  locale,
  label,
  href,
  active,
  Icon,
}: {
  locale: Locale;
  label: string;
  href: string;
  active: boolean;
  Icon: NavItem['icon'];
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        locale === 'th' ? 'caption-th' : 'caption',
        'flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-center',
        active ? 'font-semibold text-product-accent' : 'text-ink-muted',
        focusRing,
      )}
    >
      <Icon aria-hidden size={22} strokeWidth={active ? 2 : 1.75} />
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
