import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { ts, type Locale } from './i18n';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  locale: Locale;
  children: ReactNode;
  tone?: 'neutral' | 'accent';
};

/** A compact label for categories that are not lifecycle statuses. */
export function Badge({
  locale,
  tone = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      lang={locale}
      className={cn(
        ts('ui', locale),
        'inline-flex min-h-7 items-center rounded-xs border px-2 py-1',
        tone === 'neutral' && 'border-line bg-surface-sunken text-ink-muted',
        tone === 'accent' &&
          'border-product-accent-soft bg-product-accent-soft text-product-accent',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
