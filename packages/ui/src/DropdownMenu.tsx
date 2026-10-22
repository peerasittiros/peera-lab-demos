'use client';

import * as Primitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn, focusRing } from './cn';
import { ts, type Locale } from './i18n';

export const DropdownMenu = Primitive.Root;
export function DropdownMenuTrigger({
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
export const DropdownMenuRadioGroup = Primitive.RadioGroup;

export type DropdownMenuContentProps = ComponentPropsWithoutRef<
  typeof Primitive.Content
> & {
  locale: Locale;
};

export function DropdownMenuContent({
  locale,
  className,
  sideOffset = 4,
  ...props
}: DropdownMenuContentProps) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        lang={locale}
        sideOffset={sideOffset}
        className={cn(
          ts('ui', locale),
          'z-50 min-w-44 overflow-hidden rounded-sm border border-line bg-surface-raised p-1 text-ink shadow-lift',
          'transition-opacity duration-[var(--duration-fast)] data-[state=closed]:opacity-0 motion-reduce:transition-none',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

export type DropdownMenuItemProps = ComponentPropsWithoutRef<
  typeof Primitive.Item
> & {
  locale: Locale;
};

export function DropdownMenuItem({
  locale,
  className,
  ...props
}: DropdownMenuItemProps) {
  return (
    <Primitive.Item
      lang={locale}
      className={cn(
        ts('ui', locale),
        'flex min-h-11 cursor-default select-none items-center rounded-xs px-3 py-2 text-ink outline-none data-[highlighted]:bg-surface-sunken data-[disabled]:pointer-events-none data-[disabled]:text-ink-faint md:min-h-9',
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export type DropdownMenuCheckboxItemProps = ComponentPropsWithoutRef<
  typeof Primitive.CheckboxItem
> & {
  locale: Locale;
};

export function DropdownMenuCheckboxItem({
  locale,
  className,
  children,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <Primitive.CheckboxItem
      lang={locale}
      className={cn(
        ts('ui', locale),
        'relative flex min-h-11 cursor-default select-none items-center rounded-xs py-2 pr-3 pl-9 text-ink outline-none data-[highlighted]:bg-surface-sunken data-[disabled]:pointer-events-none data-[disabled]:text-ink-faint md:min-h-9',
        focusRing,
        className,
      )}
      {...props}
    >
      <span className="absolute left-3 inline-flex">
        <Primitive.ItemIndicator>
          <Check aria-hidden size={16} strokeWidth={1.75} />
        </Primitive.ItemIndicator>
      </span>
      {children}
    </Primitive.CheckboxItem>
  );
}

export type DropdownMenuRadioItemProps = ComponentPropsWithoutRef<
  typeof Primitive.RadioItem
> & {
  locale: Locale;
};

export function DropdownMenuRadioItem({
  locale,
  className,
  children,
  ...props
}: DropdownMenuRadioItemProps) {
  return (
    <Primitive.RadioItem
      lang={locale}
      className={cn(
        ts('ui', locale),
        'relative flex min-h-11 cursor-default select-none items-center rounded-xs py-2 pr-3 pl-9 text-ink outline-none data-[highlighted]:bg-surface-sunken data-[disabled]:pointer-events-none data-[disabled]:text-ink-faint md:min-h-9',
        focusRing,
        className,
      )}
      {...props}
    >
      <span className="absolute left-3 inline-flex">
        <Primitive.ItemIndicator>
          <span className="size-2 rounded-full bg-current" />
        </Primitive.ItemIndicator>
      </span>
      {children}
    </Primitive.RadioItem>
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator
      className={cn('my-1 h-px bg-line', className)}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  locale,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Primitive.Label> & { locale: Locale }) {
  return (
    <Primitive.Label
      lang={locale}
      className={cn(ts('ui', locale), 'px-3 py-2 text-ink-muted', className)}
      {...props}
    />
  );
}
