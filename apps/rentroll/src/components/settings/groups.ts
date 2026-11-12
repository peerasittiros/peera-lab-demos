import {
  Building2,
  Database,
  DoorOpen,
  Layers,
  Percent,
  Receipt,
  Users,
  type LucideIcon,
} from 'lucide-react';

// The settings pages, grouped the way an owner looks for them (ux-v2/rentroll.md › Settings). Each has its own URL
// under /owner/settings; the index lists all of them, and the side nav repeats that list from 768 px.

export type SettingsPage =
  | 'building'
  | 'buildings'
  | 'roomTypes'
  | 'rates'
  | 'billing'
  | 'people'
  | 'data';

export type SettingsSection =
  'building' | 'rooms' | 'billing' | 'people' | 'data';

export const SETTINGS_GROUPS: {
  section: SettingsSection;
  pages: { page: SettingsPage; icon: LucideIcon }[];
}[] = [
  {
    section: 'building',
    pages: [
      { page: 'building', icon: Building2 },
      { page: 'buildings', icon: Layers },
    ],
  },
  {
    section: 'rooms',
    pages: [
      { page: 'roomTypes', icon: DoorOpen },
      { page: 'rates', icon: Percent },
    ],
  },
  {
    section: 'billing',
    pages: [{ page: 'billing', icon: Receipt }],
  },
  {
    section: 'people',
    pages: [{ page: 'people', icon: Users }],
  },
  {
    section: 'data',
    pages: [{ page: 'data', icon: Database }],
  },
];

/** The folder each page lives in; the room types page is the hyphenated `room-types`, as its URL always was. */
const SLUG: Record<SettingsPage, string> = {
  building: 'building',
  buildings: 'buildings',
  roomTypes: 'room-types',
  rates: 'rates',
  billing: 'billing',
  people: 'people',
  data: 'data',
};

/** The URL of a settings page; `/owner/settings/rates`, and the index without a page. */
export const settingsPath = (locale: string, page?: SettingsPage) =>
  page
    ? `/${locale}/owner/settings/${SLUG[page]}`
    : `/${locale}/owner/settings`;
