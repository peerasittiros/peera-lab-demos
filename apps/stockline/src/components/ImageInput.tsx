'use client';

import type { Locale } from '@peera/i18n';
import { Button, cn, ts } from '@peera/ui';
import { ImagePlus, Trash2, type LucideIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { translator } from '../i18n';
import { ImageError, imageToDataUrl } from '../lib/image';

/**
 * Picks a picture and keeps it as a small data URL (the shop logo, an item photo). The file never leaves the
 * browser: it is cropped to a square and encoded by `imageToDataUrl`. The visible button opens the hidden file input,
 * so keyboard and screen readers use a normal button.
 */
export function ImageInput({
  locale,
  label,
  hint,
  value,
  onChange,
  size,
  placeholder: Placeholder,
}: {
  locale: Locale;
  label: string;
  hint?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  /** Stored square size in pixels (the logo 256, item photos 320). */
  size: number;
  placeholder: LucideIcon;
}) {
  const { m } = translator(locale);
  const i = m.image;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelId = useId();
  const hintId = useId();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await imageToDataUrl(file, { size }));
    } catch (reason) {
      const problem = reason instanceof ImageError ? reason.problem : 'read';
      setError(
        problem === 'type'
          ? i.errorType
          : problem === 'size'
            ? i.errorSize
            : i.errorRead,
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      className="flex flex-col gap-2"
    >
      <span
        id={labelId}
        className={cn(ts('ui', locale), 'font-medium text-ink')}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-4">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL from this browser; nothing to optimise
          <img
            src={value}
            alt={i.preview}
            width={80}
            height={80}
            className="size-20 shrink-0 rounded-md border border-line object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-20 shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong bg-surface-sunken text-ink-muted"
          >
            <Placeholder size={28} strokeWidth={1.5} />
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            locale={locale}
            variant="secondary"
            loading={busy}
            onClick={() => input.current?.click()}
          >
            <ImagePlus aria-hidden size={16} strokeWidth={1.75} />
            {value ? i.replace : i.choose}
          </Button>
          {value ? (
            <Button
              locale={locale}
              variant="ghost"
              onClick={() => onChange(null)}
            >
              <Trash2 aria-hidden size={16} strokeWidth={1.75} />
              {i.remove}
            </Button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(event) => void pick(event.target.files?.[0])}
        />
      </div>
      {hint ? (
        <p
          id={hintId}
          className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className={cn(ts('body-sm', locale), 'm-0 text-danger')}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
