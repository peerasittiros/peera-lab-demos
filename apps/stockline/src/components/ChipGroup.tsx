'use client';

import type { Locale } from '@peera/i18n';
import { cn, ts } from '@peera/ui';
import { useId, type ReactNode } from 'react';

export type Chip = { value: string; label: ReactNode };

/**
 * Wrapping single-choice chips (reasons, units) built on native radios: arrow keys move the choice, the legend
 * names the group, and labels wrap instead of overflowing on a 390px phone in Thai.
 */
export function ChipGroup({
  legend,
  chips,
  value,
  onChange,
  locale,
  name,
  hideLegend = false,
  className,
}: {
  legend: ReactNode;
  chips: Chip[];
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  name?: string;
  hideLegend?: boolean;
  className?: string;
}) {
  const generated = useId();
  const group = name ?? generated;
  return (
    <fieldset
      lang={locale}
      className={cn('m-0 min-w-0 border-0 p-0', className)}
    >
      <legend
        className={cn(
          ts('ui', locale),
          'mb-2 p-0 text-ink',
          hideLegend && 'sr-only',
        )}
      >
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <label key={chip.value} className="relative inline-flex">
            <input
              type="radio"
              name={group}
              value={chip.value}
              checked={value === chip.value}
              onChange={() => onChange(chip.value)}
              className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
            />
            <span
              className={cn(
                ts('ui', locale),
                'inline-flex min-h-11 items-center rounded-sm border border-line-strong bg-surface-raised px-3 py-2 text-ink',
                'peer-checked:border-product-accent peer-checked:bg-product-accent-soft',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring',
                'peer-hover:bg-surface-sunken peer-checked:peer-hover:bg-product-accent-soft',
              )}
            >
              {chip.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
