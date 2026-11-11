import type { Locale } from '@peera/i18n';
import { cn } from '@peera/ui';
import { Check } from 'lucide-react';

/** Rentroll's 12/13px metadata style (theme.css); not one of the shared type styles, so picked here. */
const caption = (locale: Locale) =>
  locale === 'th' ? 'caption-th' : 'caption';

/**
 * The "paid" stamp on a settled bill (ux-v2/rentroll.md › Motion): an outline that draws once in 360 ms around a check
 * and the word, in the paid green. Under reduced motion the outline is simply there. Decorative, so it is hidden from
 * assistive tech; the bill also says its status in words.
 */
export function PaidStamp({
  locale,
  word,
  className,
}: {
  locale: Locale;
  word: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        caption(locale),
        'rr-stamp items-center gap-1 px-3 py-1 font-semibold text-success',
        className,
      )}
    >
      <svg
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        fill="none"
        className="absolute inset-0 size-full"
      >
        <rect
          className="rr-stamp-line"
          x="1"
          y="1"
          width="98"
          height="30"
          rx="6"
          strokeWidth="2"
          pathLength="100"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <Check aria-hidden size={13} strokeWidth={3} />
      <span>{word}</span>
    </span>
  );
}
