'use client';

import { Minus, Plus } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { cn, focusRing } from './cn';
import { useFieldControl } from './Field';
import { ts, type Locale } from './i18n';
import { uiStrings } from './strings';

export type StepperProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** `lg` has 56px buttons (Stockline quick move). */
  size?: 'md' | 'lg';
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  /** Override the built-in "Decrease" / "Increase" button names. */
  decrementLabel?: string;
  incrementLabel?: string;
  locale: Locale;
  className?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** − / value / +. The value is a spinbutton: arrow keys step, Home/End jump to the bounds, typing commits on blur or Enter. */
export function Stepper({
  value,
  onValueChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  size = 'md',
  disabled = false,
  'aria-label': ariaLabel,
  decrementLabel,
  incrementLabel,
  locale,
  className,
  ...aria
}: StepperProps) {
  const {
    labelId: _labelId,
    locale: _fieldLocale,
    ...wiring
  } = useFieldControl(aria);
  const [draft, setDraft] = useState<string | null>(null);
  const strings = uiStrings[locale];
  const set = (next: number) => onValueChange(clamp(next, min, max));

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = Number(draft.trim());
    if (draft.trim() !== '' && Number.isFinite(parsed)) set(parsed);
    setDraft(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, number> = {
      ArrowUp: value + step,
      ArrowDown: value - step,
      Home: min,
      End: max,
    };
    if (event.key in keys) {
      event.preventDefault();
      setDraft(null);
      set(keys[event.key] as number);
    } else if (event.key === 'Enter') {
      commitDraft();
    }
  };

  const button = cn(
    'inline-flex shrink-0 items-center justify-center rounded-sm border border-line-strong bg-surface-raised text-ink',
    'hover:bg-surface-sunken disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-surface-raised',
    size === 'lg' ? 'size-14' : 'size-11',
    focusRing,
  );
  const iconSize = 20;

  return (
    <div
      lang={locale}
      className={cn('inline-flex items-center gap-2', className)}
    >
      <button
        type="button"
        className={button}
        aria-label={decrementLabel ?? strings.decrease}
        disabled={disabled || value <= min}
        onClick={() => set(value - step)}
      >
        <Minus aria-hidden size={iconSize} strokeWidth={1.75} />
      </button>
      <input
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max === Number.MAX_SAFE_INTEGER ? undefined : max}
        disabled={disabled}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
        {...wiring}
        className={cn(
          ts(size === 'lg' ? 'title' : 'body', locale),
          'min-w-0 rounded-sm border border-line-strong bg-surface-raised px-2 text-center text-ink tabular-nums',
          'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted',
          size === 'lg' ? 'h-14 w-24' : 'h-11 w-20',
          focusRing,
        )}
      />
      <button
        type="button"
        className={button}
        aria-label={incrementLabel ?? strings.increase}
        disabled={disabled || value >= max}
        onClick={() => set(value + step)}
      >
        <Plus aria-hidden size={iconSize} strokeWidth={1.75} />
      </button>
    </div>
  );
}
