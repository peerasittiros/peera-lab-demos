'use client';

import { useRole } from '../client-store/role';
import { formatDate, type Locale } from '@peera/i18n';
import { cn, EmptyState, Skeleton, ts } from '@peera/ui';
import { useStoreState } from '../client-store/hooks';
import { countDetail } from '../client-store/views';
import { nameIn, translator } from '../i18n';
import { AppLink } from './AppLink';
import { CountSheet, CountStatusBadge } from './CountParts';
import { PageHeader } from './PageHeader';

/** One stock count (02 §8 screen 5b): counting, submitting and approving. Reads the browser store. */
export function CountView({ id, locale }: { id: string; locale: Locale }) {
  const role = useRole();
  const { t, m } = translator(locale);
  const { ledger, status } = useStoreState();

  if (!ledger || status === 'loading')
    return <Skeleton locale={locale} lines={8} />;
  const count = countDetail(ledger, id, role);
  if (!count)
    return <EmptyState locale={locale} title={t('errors.notFound')} />;

  return (
    <>
      <PageHeader
        locale={locale}
        eyebrow={
          <AppLink
            href={`/${locale}/counts`}
            className={cn(
              ts('ui', locale),
              'inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:underline',
            )}
          >
            {m.nav.counts}
          </AppLink>
        }
        title={t('counts.detailTitle', { number: count.number })}
        description={`${count.categoryName ? nameIn(count.categoryName, locale) : m.counts.scopeAll} · ${formatDate(count.startedAt, locale)}${count.blind ? ` · ${m.counts.blind}` : ''}`}
        actions={<CountStatusBadge status={count.status} locale={locale} />}
      />
      <CountSheet
        key={`${count.status}-${count.counted}`}
        locale={locale}
        role={role}
        sessionId={count.id}
        status={count.status}
        lines={count.lines}
      />
    </>
  );
}
