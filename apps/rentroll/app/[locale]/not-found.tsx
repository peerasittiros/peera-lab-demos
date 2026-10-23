'use client';

import { useLocale } from '@peera/i18n';
import { EmptyState } from '@peera/ui';
import { translator } from '@/src/i18n';

export default function NotFound() {
  const locale = useLocale();
  const { m } = translator(locale);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">{m.common.notFound}</h1>
      <EmptyState
        locale={locale}
        title={m.common.notFound}
        description={m.common.notFoundBody}
      />
    </div>
  );
}
