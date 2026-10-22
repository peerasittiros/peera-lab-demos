import { cn } from './cn';
import { type Locale } from './i18n';
import { uiStrings } from './strings';

export type SkeletonProps = {
  locale: Locale;
  className?: string;
  lines?: number;
};

/** Loading placeholder that exposes a polite localized status to assistive tech. */
export function Skeleton({ locale, className, lines = 3 }: SkeletonProps) {
  return (
    <div
      lang={locale}
      role="status"
      aria-label={uiStrings[locale].loading}
      className={cn('space-y-3', className)}
    >
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={cn(
            'h-4 animate-pulse rounded-xs bg-surface-sunken motion-reduce:animate-none',
            index === lines - 1 && 'w-2/3',
          )}
        />
      ))}
    </div>
  );
}
