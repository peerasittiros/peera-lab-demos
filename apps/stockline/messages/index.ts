import type { Locale } from '@peera/i18n';
import { en } from './en';
import { th } from './th';

export type Messages = typeof en;
export const messages: Record<Locale, Messages> = { en, th };
