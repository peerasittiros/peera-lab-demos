'use client';

import { useDemoHref } from '@peera/demo-kit';
import { cn, focusRing } from '@peera/ui';
import { useEffect, useState } from 'react';

/** A plain link to this same page; useDemoHref adds ?sid when the session didn't arrive by cookie. */
export function AgainLink({ label }: { label: string }) {
  const demoHref = useDemoHref();
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('sid');
    setHref(demoHref(`${url.pathname}${url.search}`));
  }, [demoHref]);
  if (!href) return null;
  return (
    <a
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center text-ink underline',
        focusRing,
      )}
    >
      {label}
    </a>
  );
}
