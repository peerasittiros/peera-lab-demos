import { cn } from '@peera/ui';
import type { ReactNode } from 'react';

/** A label and its value on one line. The colon comes from CSS, so the markup holds no literal text. */
export function KV({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      <span className="text-ink-muted after:content-[':']">{label}</span>
      <span>{children}</span>
    </span>
  );
}

/** The separator between two facts on one line. */
export function Dot() {
  return (
    <span aria-hidden className="mx-2 text-ink-muted">
      {String.fromCharCode(0xb7)}
    </span>
  );
}
