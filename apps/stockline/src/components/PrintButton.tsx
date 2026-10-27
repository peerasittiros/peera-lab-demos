'use client';

import type { Locale } from '@peera/i18n';
import { Button } from '@peera/ui';
import { Printer } from 'lucide-react';

export function PrintButton({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  return (
    <Button locale={locale} variant="secondary" onClick={() => window.print()}>
      <Printer aria-hidden size={16} strokeWidth={1.75} />
      {label}
    </Button>
  );
}
