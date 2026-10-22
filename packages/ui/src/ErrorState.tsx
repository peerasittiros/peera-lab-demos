import { CircleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';
import { ts, type Locale } from './i18n';

export type ErrorStateProps = {
  locale: Locale;
  title: ReactNode;
  description?: ReactNode;
  retryLabel: ReactNode;
  onRetry: () => void;
  className?: string;
};

/** Recoverable error message with an explicit, keyboard-accessible retry action. */
export function ErrorState({
  locale,
  title,
  description,
  retryLabel,
  onRetry,
  className,
}: ErrorStateProps) {
  const titleId = useId();
  return (
    <section
      lang={locale}
      role="alert"
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col items-center gap-3 rounded-sm border border-danger bg-danger-soft p-6 text-center',
        className,
      )}
    >
      <CircleAlert
        aria-hidden="true"
        size={20}
        strokeWidth={1.75}
        className="text-danger"
      />
      <h2 id={titleId} className={cn(ts('title', locale), 'm-0 text-ink')}>
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            ts('body-sm', locale),
            'm-0 max-w-prose text-ink-muted',
          )}
        >
          {description}
        </p>
      )}
      <Button locale={locale} variant="secondary" onClick={onRetry}>
        {retryLabel}
      </Button>
    </section>
  );
}
