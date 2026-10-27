import { cn } from '@peera/ui';
import { useId } from 'react';

/**
 * Stockline's motif (ux-v2/stockline.md): a thin band of uneven vertical rules, like the edge of a shelf label.
 * Decorative only; at most two per screen (item cards and the item detail header).
 */
export function LabelStrip({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      aria-hidden
      focusable="false"
      className={cn('block h-1.5 w-full text-label opacity-40', className)}
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id={id} width="16" height="6" patternUnits="userSpaceOnUse">
          <rect x="0" width="1" height="6" fill="currentColor" />
          <rect x="3" width="2" height="6" fill="currentColor" />
          <rect x="7" width="1" height="6" fill="currentColor" />
          <rect x="10" width="3" height="6" fill="currentColor" />
          <rect x="14.5" width="0.75" height="6" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="6" fill={`url(#${id})`} />
    </svg>
  );
}
