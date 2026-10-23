'use client';

import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from 'react';
import { cn, focusRing } from './cn';
import { useFieldControl } from './Field';
import { ts, type Locale } from './i18n';

const control = cn(
  'w-full rounded-sm border border-line-strong bg-surface-raised px-3 text-ink',
  'placeholder:text-ink-faint disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted',
  'aria-invalid:border-danger',
  focusRing,
);

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Falls back to the surrounding `Field`, then to English. */
  locale?: Locale;
  /** React 19 passes refs as props; it lands on the <input>. */
  ref?: Ref<HTMLInputElement>;
};

export function Input({ locale, className, ...rest }: InputProps) {
  const {
    labelId: _labelId,
    locale: fieldLocale,
    ...wiring
  } = useFieldControl(rest);
  const lang = locale ?? fieldLocale ?? 'en';
  return (
    <input
      lang={lang}
      {...rest}
      {...wiring}
      className={cn(ts('body', lang), control, 'min-h-11 py-2', className)}
    />
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Falls back to the surrounding `Field`, then to English. */
  locale?: Locale;
  ref?: Ref<HTMLTextAreaElement>;
};

export function Textarea({
  locale,
  rows = 4,
  className,
  ...rest
}: TextareaProps) {
  const {
    labelId: _labelId,
    locale: fieldLocale,
    ...wiring
  } = useFieldControl(rest);
  const lang = locale ?? fieldLocale ?? 'en';
  return (
    <textarea
      lang={lang}
      rows={rows}
      {...rest}
      {...wiring}
      className={cn(ts('body', lang), control, 'py-2', className)}
    />
  );
}
