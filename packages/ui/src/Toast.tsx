'use client';

import * as Primitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn, focusRing } from './cn';
import { ts, type Locale } from './i18n';
import { uiStrings } from './strings';

export type ToastOptions = {
  title: ReactNode;
  description?: ReactNode;
  /** Optional stable id; generated when omitted. */
  id?: string;
};

type ToastRecord = ToastOptions & { id: string };
type ToastApi = {
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
let toastApi: ToastApi | null = null;
let nextToastId = 0;

/** Show a toast from descendants rendered inside `ToastProvider`. */
export function toast(options: ToastOptions): string {
  if (!toastApi) throw new Error('toast() requires a mounted ToastProvider.');
  return toastApi.show(options);
}

export function dismissToast(id: string): void {
  toastApi?.dismiss(id);
}

export type ToastProviderProps = {
  locale: Locale;
  children: ReactNode;
  /** Duration in milliseconds; defaults to the required four seconds. */
  duration?: number;
  label?: string;
};

/** Accessible toast host with a polite announcement region and four-second default timeout. */
export function ToastProvider({
  locale,
  children,
  duration = 4000,
  label = locale === 'th' ? 'การแจ้งเตือน' : 'Notifications',
}: ToastProviderProps) {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const show = useCallback((options: ToastOptions) => {
    const id = options.id ?? `peera-toast-${++nextToastId}`;
    setItems((current) => [
      ...current.filter((item) => item.id !== id),
      { ...options, id },
    ]);
    return id;
  }, []);
  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  // Keep the module helper aimed at the latest mounted provider, and clear it on unmount.
  // A consumer may also use the context hook below for nested providers.
  useEffect(() => {
    toastApi = api;
    return () => {
      if (toastApi === api) toastApi = null;
    };
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      <Primitive.Provider
        duration={duration}
        swipeDirection="right"
        label={label}
      >
        {children}
        <Primitive.Viewport
          lang={locale}
          label={`${label} ({hotkey})`}
          aria-label={label}
          className="fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none"
        >
          {items.map((item) => (
            <Primitive.Root
              key={item.id}
              open
              // Radix announces each toast through its own live region; "background" makes it polite.
              type="background"
              onOpenChange={(open) => {
                if (!open) dismiss(item.id);
              }}
              className={cn(
                ts('ui', locale),
                'relative flex items-start justify-between gap-4 rounded-sm border border-line bg-surface-raised p-4 pr-12 text-ink shadow-lift',
                'transition-opacity duration-[var(--duration-fast)] data-[state=closed]:opacity-0 motion-reduce:transition-none',
              )}
            >
              <div className="min-w-0">
                <Primitive.Title className="font-medium">
                  {item.title}
                </Primitive.Title>
                {item.description && (
                  <Primitive.Description className="mt-1 text-ink-muted">
                    {item.description}
                  </Primitive.Description>
                )}
              </div>
              <Primitive.Close
                aria-label={uiStrings[locale].close}
                className={cn(
                  'absolute right-1 top-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken hover:text-ink md:min-h-9 md:min-w-9',
                  focusRing,
                )}
              >
                <X aria-hidden size={16} strokeWidth={1.75} />
              </Primitive.Close>
            </Primitive.Root>
          ))}
        </Primitive.Viewport>
      </Primitive.Provider>
    </ToastContext.Provider>
  );
}

/** Context form for consumers that need a provider-scoped API. */
export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast() must be used inside ToastProvider.');
  return value;
}
