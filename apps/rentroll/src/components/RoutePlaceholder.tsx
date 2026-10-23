import type { Locale } from '@peera/i18n';
import { cn, ts } from '@peera/ui';
import type { ReactNode } from 'react';

/** Stand-in for a page that a later D3 step builds. Keeps the title (the page's only h1) and the route working. */
export function RoutePlaceholder({
  locale,
  title,
  description,
}: {
  locale: Locale;
  title: ReactNode;
  description: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className={cn(ts('headline-md', locale), 'm-0 text-ink')}>{title}</h1>
      <p className={cn(ts('body', locale), 'm-0 text-ink-muted')}>{description}</p>
    </section>
  );
}
