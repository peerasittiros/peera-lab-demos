'use client';

import { useDemoHref } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { Button, Checkbox, Field, Input, Select, cn } from '@peera/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';

export type FilterField =
  | { kind: 'search'; name: string; label: string; placeholder?: string }
  | {
      kind: 'select';
      name: string;
      label: string;
      allLabel: string;
      options: { value: string; label: ReactNode }[];
    }
  | { kind: 'date'; name: string; label: string }
  | { kind: 'checkbox'; name: string; label: string };

const ALL = '__all__';

/**
 * Filters that live in the URL (02 §8: filters round-trip through the URL), so a filtered list can be
 * bookmarked, shared and reloaded. Selects and dates apply at once; the search box applies after a short pause.
 */
export function UrlFilters({
  locale,
  fields,
  clearLabel,
  className,
}: {
  locale: Locale;
  fields: FilterField[];
  clearLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const href = useDemoHref();
  const [pending, startTransition] = useTransition();
  const searchField = fields.find((field) => field.kind === 'search');
  const [text, setText] = useState(
    searchField ? (params.get(searchField.name) ?? '') : '',
  );

  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === ALL) next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    const query = next.toString();
    startTransition(() =>
      router.replace(href(`${pathname}${query ? `?${query}` : ''}`), {
        scroll: false,
      }),
    );
  };

  useEffect(() => {
    if (!searchField) return;
    const current = params.get(searchField.name) ?? '';
    if (text.trim() === current) return;
    const timer = setTimeout(
      () => apply({ [searchField.name]: text.trim() || null }),
      300,
    );
    return () => clearTimeout(timer);
    // apply changes identity each render; the search text is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const active = fields.some((field) => params.get(field.name));

  return (
    <div
      aria-busy={pending}
      className={cn(
        'flex flex-wrap items-end gap-3 rounded-sm border border-line bg-surface-raised p-3',
        className,
      )}
    >
      {fields.map((field) => {
        if (field.kind === 'search')
          return (
            <Field
              key={field.name}
              locale={locale}
              label={field.label}
              className="min-w-[12rem] flex-[2_1_14rem]"
            >
              <Input
                type="search"
                value={text}
                placeholder={field.placeholder}
                onChange={(event) => setText(event.target.value)}
              />
            </Field>
          );
        if (field.kind === 'select')
          return (
            <Field
              key={field.name}
              locale={locale}
              label={field.label}
              className="min-w-[10rem] flex-[1_1_10rem]"
            >
              <Select
                locale={locale}
                value={params.get(field.name) ?? ALL}
                onValueChange={(value) => apply({ [field.name]: value })}
                options={[
                  { value: ALL, label: field.allLabel },
                  ...field.options,
                ]}
              />
            </Field>
          );
        if (field.kind === 'date')
          return (
            <Field
              key={field.name}
              locale={locale}
              label={field.label}
              className="min-w-[9rem] flex-[1_1_9rem]"
            >
              <Input
                type="date"
                value={params.get(field.name) ?? ''}
                onChange={(event) =>
                  apply({ [field.name]: event.target.value || null })
                }
              />
            </Field>
          );
        return (
          <div key={field.name} className="flex min-h-11 items-center">
            <Checkbox
              locale={locale}
              label={field.label}
              checked={params.get(field.name) === '1'}
              onCheckedChange={(checked) =>
                apply({ [field.name]: checked ? '1' : null })
              }
            />
          </div>
        );
      })}
      {active ? (
        <Button
          locale={locale}
          variant="ghost"
          onClick={() => {
            setText('');
            apply(
              Object.fromEntries(fields.map((field) => [field.name, null])),
            );
          }}
        >
          {clearLabel}
        </Button>
      ) : null}
    </div>
  );
}
