import { getPluralT, getT, type Locale } from '@peera/i18n';
import { messages, type Messages } from '@/messages';

export type { Messages };

/** `t` for plain messages and `tp` for plural ones, on the server or in client components. */
export function translator(locale: Locale) {
  return {
    t: getT(locale, messages[locale]),
    tp: getPluralT(locale, messages[locale]),
    m: messages[locale],
  };
}
