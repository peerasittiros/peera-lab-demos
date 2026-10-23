import type { Locale } from '@peera/i18n';
import { cn, ts } from '@peera/ui';
import type { ReactNode } from 'react';

/** Page title (the page's only h1), a line of context, and at most one primary action plus secondary ones. */
export function PageHeader({
  locale,
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  locale: Locale;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3',
        className,
      )}
    >
      <div className="min-w-0 max-w-[48rem]">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className={cn(ts('headline-md', locale), 'm-0 text-ink')}>
          {title}
        </h1>
        {description ? (
          <p className={cn(ts('body', locale), 'mt-1 mb-0 text-ink-muted')}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** Section heading inside a page (h2). */
export function SectionTitle({
  locale,
  children,
  className,
  id,
}: {
  locale: Locale;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <h2 id={id} className={cn(ts('title', locale), 'm-0 text-ink', className)}>
      {children}
    </h2>
  );
}
