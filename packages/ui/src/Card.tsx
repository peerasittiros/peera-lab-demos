import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { ts, type Locale } from './i18n';

export type CardProps = HTMLAttributes<HTMLElement> & {
  locale: Locale;
  children: ReactNode;
};

/** Raised surface for grouping related content. */
export function Card({ locale, className, children, ...props }: CardProps) {
  return (
    <section
      lang={locale}
      className={cn(
        ts('body', locale),
        'rounded-sm border border-line bg-surface-raised p-4 text-ink shadow-sm md:p-5',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
