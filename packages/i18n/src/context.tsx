'use client';

import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from 'react';
import type { Locale } from './locale';
import { getT, type MessageTree } from './messages';

type LocaleContextValue = { locale: Locale; messages: MessageTree };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  messages,
  children,
}: LocaleContextValue & { children: ReactNode }) {
  return createElement(
    LocaleContext.Provider,
    { value: { locale, messages } },
    children,
  );
}

/** Client hook. Supply the app's inferred message type for key-safe translation calls. */
export function useT<M extends MessageTree = MessageTree>() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useT() must be used inside LocaleProvider');
  return getT(context.locale, context.messages as M);
}

export function useLocale(): Locale {
  const context = useContext(LocaleContext);
  if (!context)
    throw new Error('useLocale() must be used inside LocaleProvider');
  return context.locale;
}
