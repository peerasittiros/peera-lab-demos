'use client';

import * as Primitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn, focusRing } from './cn';
import { ts, type Locale } from './i18n';
import { uiStrings } from './strings';

export const Dialog = Primitive.Root;
export function DialogTrigger({
  locale,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Primitive.Trigger> & { locale: Locale }) {
  return (
    <Primitive.Trigger
      lang={locale}
      className={cn(
        ts('ui', locale),
        'min-h-11 rounded-sm',
        focusRing,
        className,
      )}
      {...props}
    />
  );
}
export function DialogClose({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Primitive.Close>) {
  return (
    <Primitive.Close
      className={cn('min-h-11 rounded-sm', focusRing, className)}
      {...props}
    />
  );
}

export type DialogContentProps = ComponentPropsWithoutRef<
  typeof Primitive.Content
> & {
  locale: Locale;
};

/** Accessible modal dialog; Radix traps focus, handles Escape and restores focus. */
export function DialogContent({
  locale,
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-ink/50" />
      <Primitive.Content
        lang={locale}
        className={cn(
          ts('ui', locale),
          'fixed left-1/2 top-1/2 z-50 max-h-[min(85dvh,48rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-line bg-surface-raised p-5 text-ink shadow-lift md:p-6',
          'transition-opacity duration-[var(--duration-fast)] data-[state=closed]:opacity-0 motion-reduce:transition-none',
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close
          aria-label={uiStrings[locale].close}
          className={cn(
            'absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken hover:text-ink md:min-h-9 md:min-w-9',
            focusRing,
          )}
        >
          <X aria-hidden size={20} strokeWidth={1.75} />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export type DialogTitleProps = ComponentPropsWithoutRef<
  typeof Primitive.Title
> & {
  locale: Locale;
};

export function DialogTitle({ locale, className, ...props }: DialogTitleProps) {
  return (
    <Primitive.Title
      lang={locale}
      className={cn(ts('title', locale), 'pr-10 text-ink', className)}
      {...props}
    />
  );
}

export type DialogDescriptionProps = ComponentPropsWithoutRef<
  typeof Primitive.Description
> & {
  locale: Locale;
};

export function DialogDescription({
  locale,
  className,
  ...props
}: DialogDescriptionProps) {
  return (
    <Primitive.Description
      lang={locale}
      className={cn(ts('body-sm', locale), 'mt-1 text-ink-muted', className)}
      {...props}
    />
  );
}
