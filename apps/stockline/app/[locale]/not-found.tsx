'use client';

import { useLocale } from '@peera/i18n';
import { EmptyState } from '@peera/ui';
import { AppLink } from '@/src/components/AppLink';
import { buttonLink } from '@/src/components/styles';
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
        action={
          <AppLink
            href={`/${locale}`}
            className={buttonLink(locale, 'secondary', 'mt-2')}
          >
            {m.common.backToStart}
          </AppLink>
        }
      />
    </div>
  );
}
