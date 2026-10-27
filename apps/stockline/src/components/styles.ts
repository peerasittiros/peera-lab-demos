import type { Locale } from '@peera/i18n';
import { cn, focusRing, ts } from '@peera/ui';

const variants = {
  primary: 'bg-product-accent text-product-on-accent hover:opacity-90',
  secondary:
    'border border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken',
  ghost: 'text-ink hover:bg-surface-sunken',
} as const;

/** A link that looks like a Button (same sizes and variants). `primary` is the one accent action per view. */
export function buttonLink(
  locale: Locale,
  variant: keyof typeof variants = 'secondary',
  className?: string,
) {
  return cn(
    ts('ui', locale),
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 py-2 text-center md:min-h-10',
    variants[variant],
    focusRing,
    className,
  );
}
