'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, focusRing } from './cn';
import { useFieldControl } from './Field';
import { ts, type Locale } from './i18n';

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type SelectProps = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: ReactNode;
  disabled?: boolean;
  name?: string;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  required?: boolean;
  locale: Locale;
  className?: string;
};

/** Radix Select styled with tokens. Inside a `Field`, the label names the trigger. */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled,
  name,
  locale,
  className,
  ...aria
}: SelectProps) {
  const {
    labelId: _labelId,
    locale: _fieldLocale,
    ...wiring
  } = useFieldControl(aria);
  return (
    <RadixSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
      required={wiring.required}
    >
      <RadixSelect.Trigger
        lang={locale}
        id={wiring.id}
        aria-describedby={wiring['aria-describedby']}
        aria-invalid={wiring['aria-invalid']}
        className={cn(
          ts('body', locale),
          'inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-line-strong bg-surface-raised px-3 py-2 text-left text-ink',
          'data-[placeholder]:text-ink-faint disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted',
          'aria-invalid:border-danger',
          focusRing,
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={1.75}
            className="text-ink-muted"
          />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          lang={locale}
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-sm border border-line bg-surface-raised shadow-lift"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  ts('body', locale),
                  'relative flex min-h-11 cursor-default select-none items-center rounded-xs py-2 pr-3 pl-8 text-ink outline-none md:min-h-9',
                  'data-[highlighted]:bg-surface-sunken data-[disabled]:text-ink-faint',
                )}
              >
                <RadixSelect.ItemIndicator className="absolute left-2 inline-flex">
                  <Check aria-hidden size={16} strokeWidth={1.75} />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
