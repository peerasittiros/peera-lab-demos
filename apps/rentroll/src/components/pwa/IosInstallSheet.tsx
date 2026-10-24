'use client';

import type { Locale } from '@peera/i18n';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Button,
} from '@peera/ui';
import { translator } from '@/src/i18n';

/** Three steps for iPhone and iPad, where Safari has no install prompt (SPEC §6). */
export function IosInstallSheet({
  locale,
  open,
  onOpenChange,
}: {
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { m } = translator(locale);
  const p = m.pwa;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent locale={locale}>
        <SheetTitle locale={locale}>{p.iosTitle}</SheetTitle>
        <SheetDescription locale={locale} className="sr-only">
          {p.iosTitle}
        </SheetDescription>
        <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5 text-ink">
          <li>{p.iosStep1}</li>
          <li>{p.iosStep2}</li>
          <li>{p.iosStep3}</li>
        </ol>
        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            locale={locale}
            onClick={() => onOpenChange(false)}
          >
            {p.close}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
