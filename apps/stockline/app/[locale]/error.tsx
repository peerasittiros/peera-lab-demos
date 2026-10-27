'use client';

import { useLocale } from '@peera/i18n';
import { ErrorState } from '@peera/ui';
import { useEffect } from 'react';
import { translator } from '@/src/i18n';

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const { m } = translator(locale);
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorState
      locale={locale}
      title={m.common.pageError}
      description={m.common.pageErrorBody}
      retryLabel={m.common.retry}
      onRetry={reset}
    />
  );
}
