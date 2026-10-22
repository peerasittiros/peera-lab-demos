'use client';

import * as Primitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn, focusRing } from './cn';
import { ts, type Locale } from './i18n';
import { uiStrings } from './strings';

export const Sheet = Primitive.Root;
export function SheetTrigger({
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
export function SheetClose({
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

export type SheetContentProps = ComponentPropsWithoutRef<
  typeof Primitive.Content
> & {
  locale: Locale;
};

/** Responsive modal sheet: bottom-anchored on mobile and a right panel at 768px+. */
export function SheetContent({
  locale,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-ink/50" />
      <Primitive.Content
        lang={locale}
        className={cn(
          ts('ui', locale),
          'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-md border border-line bg-surface-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-lift',
          'transition-transform duration-[var(--duration-base)] data-[state=closed]:translate-y-full motion-reduce:transition-none',
          'md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[min(28rem,90vw)] md:translate-y-0 md:rounded-none md:border-y-0 md:border-r-0 md:border-l md:pb-5 md:data-[state=closed]:translate-y-0 md:data-[state=closed]:translate-x-full',
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

export type SheetTitleProps = ComponentPropsWithoutRef<
  typeof Primitive.Title
> & {
  locale: Locale;
};

export function SheetTitle({ locale, className, ...props }: SheetTitleProps) {
  return (
    <Primitive.Title
      lang={locale}
      className={cn(ts('title', locale), 'pr-10 text-ink', className)}
      {...props}
    />
  );
}

export type SheetDescriptionProps = ComponentPropsWithoutRef<
  typeof Primitive.Description
> & {
  locale: Locale;
};

export function SheetDescription({
  locale,
  className,
  ...props
}: SheetDescriptionProps) {
  return (
    <Primitive.Description
      lang={locale}
      className={cn(ts('body-sm', locale), 'mt-1 text-ink-muted', className)}
      {...props}
    />
  );
}
