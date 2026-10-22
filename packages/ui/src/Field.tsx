'use client';

import { CircleAlert } from 'lucide-react';
import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from './cn';
import { ts, type Locale } from './i18n';
import { uiStrings } from './strings';

type FieldContextValue = {
  id: string;
  labelId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
  locale: Locale;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** Error text. When set, the control gets `aria-invalid` and the text joins its `aria-describedby`. */
  error?: ReactNode;
  required?: boolean;
  locale: Locale;
  /** Id for the control; generated when omitted. */
  id?: string;
  className?: string;
  children: ReactNode;
};

/** Label, hint and error wired to the one control inside it. */
export function Field({
  label,
  hint,
  error,
  required = false,
  locale,
  id,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const context: FieldContextValue = {
    id: controlId,
    labelId: `${controlId}-label`,
    describedBy,
    invalid: Boolean(error),
    required,
    locale,
  };

  return (
    <FieldContext.Provider value={context}>
      <div lang={locale} className={cn('flex flex-col gap-1.5', className)}>
        <label
          id={context.labelId}
          htmlFor={controlId}
          className={cn(ts('ui', locale), 'text-ink')}
        >
          {label}
          {required && (
            <span className="text-ink-muted">
              {' '}
              ({uiStrings[locale].required})
            </span>
          )}
        </label>
        {children}
        {hint && (
          <p
            id={hintId}
            className={cn(ts('body-sm', locale), 'text-ink-muted')}
          >
            {hint}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            className={cn(
              ts('body-sm', locale),
              'flex items-start gap-1.5 text-danger',
            )}
          >
            <CircleAlert
              aria-hidden
              size={16}
              strokeWidth={1.75}
              className="mt-1 shrink-0"
            />
            <span>{error}</span>
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

type ControlAria = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  required?: boolean;
};

/** Merges a control's own id and ARIA props with the surrounding `Field`, if any. */
export function useFieldControl<P extends ControlAria>(props: P) {
  const field = useField();
  const describedBy =
    [props['aria-describedby'], field?.describedBy].filter(Boolean).join(' ') ||
    undefined;
  return {
    id: props.id ?? field?.id,
    'aria-describedby': describedBy,
    'aria-invalid': props['aria-invalid'] ?? (field?.invalid || undefined),
    required: props.required ?? (field?.required || undefined),
    locale: field?.locale,
    labelId: field?.labelId,
  };
}
