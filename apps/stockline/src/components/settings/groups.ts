import {
  Database,
  Ruler,
  SlidersHorizontal,
  Store,
  Tags,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

// Settings pages, grouped the way a shop owner looks for them. Each page has its own URL under /settings.

export type SettingsPage =
  'shop' | 'users' | 'categories' | 'units' | 'suppliers' | 'stock' | 'data';

export type SettingsSection = 'shop' | 'catalog' | 'stock' | 'data';

export const SETTINGS_GROUPS: {
  section: SettingsSection;
  pages: { page: SettingsPage; icon: LucideIcon }[];
}[] = [
  {
    section: 'shop',
    pages: [
      { page: 'shop', icon: Store },
      { page: 'users', icon: Users },
    ],
  },
  {
    section: 'catalog',
    pages: [
      { page: 'categories', icon: Tags },
      { page: 'units', icon: Ruler },
      { page: 'suppliers', icon: Truck },
    ],
  },
  { section: 'stock', pages: [{ page: 'stock', icon: SlidersHorizontal }] },
  { section: 'data', pages: [{ page: 'data', icon: Database }] },
];

export const settingsPath = (locale: string, page?: SettingsPage) =>
  page ? `/${locale}/settings/${page}` : `/${locale}/settings`;
