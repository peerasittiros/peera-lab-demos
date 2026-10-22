'use client';

import * as RadixSwitch from '@radix-ui/react-switch';
import { useId } from 'react';
import { toggleRow, type ToggleProps } from './Checkbox';
import { cn, focusRing } from './cn';
import { ts } from './i18n';

export type SwitchProps = ToggleProps;

/** On/off switch. Square corners like every control here: the lab has no pills. */
export function Switch({ label, id, locale, className, ...rest }: SwitchProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div lang={locale} className={cn(toggleRow, className)}>
      <RadixSwitch.Root
        id={controlId}
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 items-center rounded-sm border border-line-strong bg-surface-sunken',
          'transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none',
          'data-[state=checked]:border-ink data-[state=checked]:bg-ink',
          'disabled:cursor-not-allowed disabled:opacity-50',
          focusRing,
        )}
        {...rest}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block size-4 translate-x-0.5 rounded-xs bg-ink-muted',
            'transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none',
            'data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-surface',
          )}
        />
      </RadixSwitch.Root>
      <label
        htmlFor={controlId}
        className={cn(ts('body', locale), 'cursor-pointer')}
      >
        {label}
      </label>
    </div>
  );
}
