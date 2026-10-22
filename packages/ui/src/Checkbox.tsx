'use client';

import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn, focusRing } from './cn';
import { ts, type Locale } from './i18n';

export type ToggleProps = {
  label: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  id?: string;
  locale: Locale;
  className?: string;
};

/** Row layout shared with `Switch`: the whole row is the touch target, at least 44px tall. */
export const toggleRow =
  'inline-flex min-h-11 cursor-pointer items-center gap-3 text-ink';

export type CheckboxProps = ToggleProps;

export function Checkbox({
  label,
  id,
  locale,
  className,
  onCheckedChange,
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div lang={locale} className={cn(toggleRow, className)}>
      <RadixCheckbox.Root
        id={controlId}
        onCheckedChange={(state) => onCheckedChange?.(state === true)}
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center rounded-xs border border-line-strong bg-surface-raised',
          'data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-surface',
          'disabled:cursor-not-allowed disabled:opacity-50',
          focusRing,
        )}
        {...rest}
      >
        <RadixCheckbox.Indicator>
          <Check aria-hidden size={16} strokeWidth={1.75} />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <label
        htmlFor={controlId}
        className={cn(ts('body', locale), 'cursor-pointer')}
      >
        {label}
      </label>
    </div>
  );
}
