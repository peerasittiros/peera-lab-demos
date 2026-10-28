import {
  Building2,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileSignature,
  FileText,
  Gauge,
  Home,
  Megaphone,
  Receipt,
  Settings,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/src/client-store/schema';

/**
 * What each role can reach (SPEC §3). `tabs` are the bottom bar (below 1024px, at most four; "More" comes after them).
 * `sections` is everything the role can open: the sidebar shows all of it, and the More sheet shows the part the bar
 * doesn't. Both are the same list, so no page is reachable on one screen size only.
 */
export type NavKey =
  | 'home'
  | 'dashboard'
  | 'rooms'
  | 'tenants'
  | 'contracts'
  | 'moveIn'
  | 'meters'
  | 'billing'
  | 'invoices'
  | 'payments'
  | 'overdue'
  | 'repairs'
  | 'announcements'
  | 'rentRoll'
  | 'utilities'
  | 'deposits'
  | 'buildings'
  | 'rates'
  | 'roomTypes'
  | 'settings'
  | 'reports'
  | 'bills'
  | 'myRepairs';

export type NavItem = {
  key: NavKey;
  path: string;
  icon: LucideIcon;
  /**
   * The path that makes this item active, when it differs from `path` (for example the meter round for the current
   * period is active on every `/owner/meters/...` page).
   */
  match?: string;
  /** Active only on the exact path (the home pages, whose paths are prefixes of every other page). */
  exact?: boolean;
  /** The sidebar group it sits under; items without one follow the groups, apart (Settings). */
  group?: NavGroup;
};

export type NavGroup = 'month' | 'people' | 'building';

export type RoleNav = { tabs: NavItem[]; sections: NavItem[] };

// The owner's sections in three groups (ux-v2/rentroll.md › Shell), then Reports and Settings apart, each an index of
// its pages (rent roll, utilities, deposits; buildings, room types, rates), so the sidebar fits 1280 × 800 unscrolled.
const OWNER_SECTIONS: NavItem[] = [
  { key: 'dashboard', path: '/owner/dashboard', icon: Home, group: 'month' },
  {
    key: 'meters',
    path: '/owner/meters/current',
    match: '/owner/meters',
    icon: Gauge,
    group: 'month',
  },
  {
    key: 'billing',
    path: '/owner/billing/current',
    match: '/owner/billing',
    icon: Receipt,
    group: 'month',
  },
  { key: 'invoices', path: '/owner/invoices', icon: FileText, group: 'month' },
  {
    key: 'payments',
    path: '/owner/payments/review',
    match: '/owner/payments',
    icon: CreditCard,
    group: 'month',
  },
  { key: 'overdue', path: '/owner/overdue', icon: Wallet, group: 'month' },
  { key: 'rooms', path: '/owner/rooms', icon: Building2, group: 'people' },
  { key: 'tenants', path: '/owner/tenants', icon: Users, group: 'people' },
  {
    key: 'contracts',
    path: '/owner/contracts',
    icon: FileSignature,
    group: 'people',
  },
  { key: 'moveIn', path: '/owner/move-in', icon: DoorOpen, group: 'people' },
  { key: 'repairs', path: '/owner/repairs', icon: Wrench, group: 'building' },
  {
    key: 'announcements',
    path: '/owner/announcements',
    icon: Megaphone,
    group: 'building',
  },
  { key: 'reports', path: '/owner/reports', icon: ClipboardList },
  { key: 'settings', path: '/owner/settings', icon: Settings },
];

const CARETAKER_SECTIONS: NavItem[] = [
  {
    key: 'meters',
    path: '/owner/meters/current',
    match: '/owner/meters',
    icon: Gauge,
  },
  { key: 'rooms', path: '/owner/rooms', icon: Building2 },
  { key: 'repairs', path: '/owner/repairs', icon: Wrench },
  {
    key: 'payments',
    path: '/owner/payments/review',
    match: '/owner/payments',
    icon: CreditCard,
  },
  { key: 'announcements', path: '/owner/announcements', icon: Megaphone },
];

const TENANT_SECTIONS: NavItem[] = [
  { key: 'home', path: '/t', exact: true, icon: Home },
  { key: 'bills', path: '/t/bills', icon: Receipt },
  { key: 'myRepairs', path: '/t/repairs', icon: Wrench },
];

/** The bottom-bar entries of a role, in order, picked from its sections by key. */
function tabsOf(sections: NavItem[], keys: NavKey[]): NavItem[] {
  return keys.map((key) => sections.find((item) => item.key === key)!);
}

export const ROLE_NAV: Record<Role, RoleNav> = {
  owner: {
    tabs: tabsOf(OWNER_SECTIONS, ['dashboard', 'rooms', 'meters', 'billing']),
    sections: OWNER_SECTIONS,
  },
  caretaker: {
    tabs: tabsOf(CARETAKER_SECTIONS, [
      'meters',
      'rooms',
      'repairs',
      'payments',
    ]),
    sections: CARETAKER_SECTIONS,
  },
  tenant: {
    tabs: tabsOf(TENANT_SECTIONS, ['home', 'bills', 'myRepairs']),
    sections: TENANT_SECTIONS,
  },
};

/** Where each role lands (ux-v2/rentroll.md › Shell): the owner on the overview, the caretaker on the meter round. */
export function homePath(role: Role): string {
  if (role === 'tenant') return '/t';
  if (role === 'caretaker') return '/owner/meters/current';
  return '/owner/dashboard';
}

/** Whether `pathname` (with the locale prefix) is on this nav item. */
export function isNavActive(
  item: NavItem,
  pathname: string,
  locale: string,
): boolean {
  const base = `/${locale}${item.match ?? item.path}`;
  if (item.exact) return pathname === base;
  return pathname === base || pathname.startsWith(`${base}/`);
}
