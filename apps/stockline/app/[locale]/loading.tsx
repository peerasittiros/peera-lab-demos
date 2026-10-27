'use client';

import { useLocale } from '@peera/i18n';
import { Skeleton } from '@peera/ui';

export default function Loading() {
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-6">
      <Skeleton locale={locale} lines={2} className="max-w-[24rem]" />
      <Skeleton locale={locale} lines={6} />
    </div>
  );
}
