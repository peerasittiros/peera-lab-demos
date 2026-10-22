import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { ts, type Locale } from './i18n';
import { uiStrings } from './strings';

export type KpiDelta = {
  value: string | number;
  direction: 'up' | 'down' | 'flat';
};

export type KpiTileProps = {
  locale: Locale;
  label: ReactNode;
  value: ReactNode;
  delta?: KpiDelta;
  className?: string;
};

const DeltaIcon = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

/** Metric tile whose delta is announced with its direction, not just an arrow. */
export function KpiTile({
  locale,
  label,
  value,
  delta,
  className,
}: KpiTileProps) {
  const Icon = delta ? DeltaIcon[delta.direction] : null;
  const deltaLabel = delta
    ? {
        up: uiStrings[locale].deltaIncrease,
        down: uiStrings[locale].decreaseChange,
        flat: uiStrings[locale].deltaNoChange,
      }[delta.direction]
    : undefined;
  return (
    <section
      lang={locale}
      className={cn(
        'rounded-sm border border-line bg-surface-raised p-4 shadow-sm',
        className,
      )}
      aria-label={typeof label === 'string' ? label : undefined}
    >
      <p className={cn(ts('ui', locale), 'm-0 text-ink-muted')}>{label}</p>
      <p
        className={cn(ts('headline-sm', locale), 'my-2 text-ink tabular-nums')}
      >
        {value}
      </p>
      {delta && Icon && (
        <p
          className={cn(
            ts('body-sm', locale),
            'm-0 inline-flex items-center gap-1.5 text-ink-muted',
          )}
        >
          <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
          <span>
            {delta.value}
            {deltaLabel && <span> {deltaLabel}</span>}
          </span>
        </p>
      )}
    </section>
  );
}
