'use client';

import * as Primitive from '@radix-ui/react-tabs';
import type { ComponentPropsWithoutRef } from 'react';
import { cn, focusRing } from './cn';
import { ts, type Locale } from './i18n';

export type TabsProps = ComponentPropsWithoutRef<typeof Primitive.Root> & {
  locale: Locale;
};

export function Tabs({ locale, className, ...props }: TabsProps) {
  return <Primitive.Root lang={locale} className={className} {...props} />;
}

export type TabsListProps = ComponentPropsWithoutRef<typeof Primitive.List> & {
  locale: Locale;
};

export function TabsList({ locale, className, ...props }: TabsListProps) {
  return (
    <Primitive.List
      lang={locale}
      className={cn('flex flex-wrap gap-1 border-b border-line', className)}
      {...props}
    />
  );
}

export type TabsTriggerProps = ComponentPropsWithoutRef<
  typeof Primitive.Trigger
> & {
  locale: Locale;
};

export function TabsTrigger({ locale, className, ...props }: TabsTriggerProps) {
  return (
    <Primitive.Trigger
      lang={locale}
      className={cn(
        ts('ui', locale),
        'min-h-11 rounded-t-sm border-b-2 border-transparent px-3 py-2 text-ink-muted transition-colors duration-[var(--duration-fast)] hover:text-ink data-[state=active]:border-product-accent data-[state=active]:text-ink motion-reduce:transition-none md:min-h-10',
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export type TabsContentProps = ComponentPropsWithoutRef<
  typeof Primitive.Content
> & {
  locale: Locale;
};

export function TabsContent({ locale, className, ...props }: TabsContentProps) {
  return (
    <Primitive.Content
      lang={locale}
      className={cn('pt-4 outline-none', focusRing, className)}
      {...props}
    />
  );
}
