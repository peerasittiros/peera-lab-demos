import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn, focusRing } from './cn';
import { ts, type Locale } from './i18n';
import { uiStrings } from './strings';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` is the product accent fill: use at most one per view. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets `aria-busy` and blocks clicks; the label stays. */
  loading?: boolean;
  locale: Locale;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-product-accent text-product-on-accent hover:opacity-90 disabled:opacity-50',
  secondary:
    'border border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken disabled:text-ink-faint',
  ghost: 'text-ink hover:bg-surface-sunken disabled:text-ink-faint',
  danger:
    'border border-danger bg-surface-raised text-danger hover:bg-danger-soft disabled:opacity-50',
};

// Every size is at least 44px tall below 768px (touch); sm and md tighten on larger screens.
const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 md:min-h-8',
  md: 'min-h-11 px-4 md:min-h-10',
  lg: 'min-h-12 px-5',
};

/** Button with the lab's variants. Labels grow and wrap; they never truncate. */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  locale,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      lang={locale}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        ts('ui', locale),
        'inline-flex items-center justify-center gap-2 rounded-sm py-2 text-center',
        'transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none',
        'disabled:cursor-not-allowed',
        focusRing,
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <LoaderCircle
          size={16}
          strokeWidth={1.75}
          aria-label={uiStrings[locale].loading}
          className="shrink-0 animate-spin motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}
