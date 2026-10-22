'use client';

import * as Primitive from '@radix-ui/react-popover';
import type { ComponentPropsWithoutRef } from 'react';
import { cn, focusRing } from './cn';
import { ts, type Locale } from './i18n';

export const Popover = Primitive.Root;
export function PopoverTrigger({
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
export const PopoverAnchor = Primitive.Anchor;

export type PopoverContentProps = ComponentPropsWithoutRef<
  typeof Primitive.Content
> & {
  locale: Locale;
};

/** Positioned popover with Radix dismissal and keyboard handling. */
export function PopoverContent({
  locale,
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: PopoverContentProps) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        lang={locale}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          ts('ui', locale),
          'z-50 max-h-[var(--radix-popover-content-available-height)] min-w-40 overflow-y-auto rounded-sm border border-line bg-surface-raised p-3 text-ink shadow-lift',
          'transition-opacity duration-[var(--duration-fast)] data-[state=closed]:opacity-0 motion-reduce:transition-none',
          focusRing,
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
