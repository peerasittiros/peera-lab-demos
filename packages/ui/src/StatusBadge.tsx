import {
  Check,
  Circle,
  Info,
  OctagonAlert,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { cn } from './cn';
import { ts, type Locale } from './i18n';

/** Semantic tone. Each app maps its own statuses (low stock, overdue, paid…) to one of these. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type StatusBadgeProps = {
  tone: StatusTone;
  /** The visible word, already localized by the app ("ใกล้หมด" / "Low"). Never omitted: status is never color alone. */
  label: string;
  locale: Locale;
  /** Overrides the tone's default icon when a status needs a more specific one. */
  icon?: LucideIcon;
  className?: string;
};

const toneStyles: Record<StatusTone, { Icon: LucideIcon; className: string }> =
  {
    success: { Icon: Check, className: 'bg-success-soft text-success' },
    warning: { Icon: TriangleAlert, className: 'bg-warning-soft text-warning' },
    danger: { Icon: OctagonAlert, className: 'bg-danger-soft text-danger' },
    info: { Icon: Info, className: 'bg-info-soft text-info' },
    neutral: { Icon: Circle, className: 'bg-surface-sunken text-ink-muted' },
  };

/** A status with an icon and a visible word on the semantic soft colors. */
export function StatusBadge({
  tone,
  label,
  locale,
  icon,
  className,
}: StatusBadgeProps) {
  const { Icon: DefaultIcon, className: toneClassName } = toneStyles[tone];
  const Icon = icon ?? DefaultIcon;
  return (
    <span
      lang={locale}
      className={cn(
        ts('ui', locale),
        'inline-flex min-h-7 items-center gap-1.5 rounded-xs px-2 py-1',
        toneClassName,
        className,
      )}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
      <span>{label}</span>
    </span>
  );
}
