import type { Locale } from './i18n';

/** Built-in strings of the primitives. App copy belongs in each app's messages, not here. */
export const uiStrings = {
  en: {
    loading: 'Loading',
    decrease: 'Decrease',
    increase: 'Increase',
    required: 'Required',
  },
  th: {
    loading: 'กำลังโหลด',
    decrease: 'ลดจำนวน',
    increase: 'เพิ่มจำนวน',
    required: 'จำเป็น',
  },
} as const satisfies Record<Locale, Record<string, string>>;
