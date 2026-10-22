import { useId, type ReactNode } from 'react';
import { cn } from './cn';
import { ts, type Locale } from './i18n';

export type EmptyStateProps = {
  locale: Locale;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Quiet, localized structure for a collection with no records yet. */
export function EmptyState({
  locale,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const titleId = useId();
  return (
    <section
      lang={locale}
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col items-center gap-2 rounded-sm border border-dashed border-line p-6 text-center',
        className,
      )}
    >
      <h2 id={titleId} className={cn(ts('title', locale), 'm-0 text-ink')}>
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            ts('body-sm', locale),
            'm-0 max-w-prose text-ink-muted',
          )}
        >
          {description}
        </p>
      )}
      {action}
    </section>
  );
}
