'use client';

import * as RadioGroup from '@radix-ui/react-radio-group';
import type { ReactNode } from 'react';
import { cn, focusRing } from './cn';
import { useField } from './Field';
import { ts, type Locale } from './i18n';

/** Colour of the selected segment's label, e.g. Stockline In = accent, Out = ink, Adjust = warning. */
export type SegmentTone = 'ink' | 'accent' | 'warning';

export type SegmentOption = {
  value: string;
  label: ReactNode;
  tone?: SegmentTone;
  disabled?: boolean;
};

export type SegmentedControlProps = {
  options: SegmentOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Needed outside a `Field`; inside one, the field label names the group. */
  'aria-label'?: string;
  name?: string;
  disabled?: boolean;
  /** Segments share the full width instead of sizing to their labels. */
  fullWidth?: boolean;
  locale: Locale;
  className?: string;
};

const tones: Record<SegmentTone, string> = {
  ink: 'data-[state=checked]:text-ink',
  accent: 'data-[state=checked]:text-product-accent',
  warning: 'data-[state=checked]:text-warning',
};

/** One choice out of a few, as a radio group: arrow keys move and select. */
export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  'aria-label': ariaLabel,
  name,
  disabled,
  fullWidth = false,
  locale,
  className,
}: SegmentedControlProps) {
  const field = useField();
  return (
    <RadioGroup.Root
      lang={locale}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      disabled={disabled}
      orientation="horizontal"
      loop
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : field?.labelId}
      aria-describedby={field?.describedBy}
      className={cn(
        'gap-1 rounded-sm bg-surface-sunken p-1',
        fullWidth ? 'flex w-full' : 'inline-flex',
        className,
      )}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            ts('ui', locale),
            'min-h-10 rounded-xs px-3 py-2 text-center text-ink-muted',
            'transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none',
            'hover:text-ink data-[state=checked]:bg-surface-raised data-[state=checked]:shadow-sm',
            'disabled:cursor-not-allowed disabled:text-ink-faint',
            fullWidth && 'flex-1',
            tones[option.tone ?? 'ink'],
            focusRing,
          )}
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
