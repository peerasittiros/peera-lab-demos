'use client';

import { useRole } from '../client-store/role';
import type { Locale } from '@peera/i18n';
import { EmptyState, Skeleton } from '@peera/ui';
import { reorderGroups } from '../client-store/views';
import { useStoreState } from '../client-store/hooks';
import { translator, weekdayName } from '../i18n';
import { PageHeader } from './PageHeader';
import { ReorderBoard } from './ReorderBoard';

/** The reorder page: this week's list grouped by supplier, from the browser store. */
export function ReorderView({ locale }: { locale: Locale }) {
  const role = useRole();
  const { t, m } = translator(locale);
  const { ledger, status } = useStoreState();

  // The title is in the server HTML; the subtitle needs the shop's data, so it comes with the body.
  if (!ledger || status === 'loading')
    return (
      <>
        <PageHeader locale={locale} title={m.reorder.title} />
        <Skeleton locale={locale} lines={8} />
      </>
    );
  const groups = reorderGroups(ledger, role);
  const shopName =
    (locale === 'en' && ledger.settings.shopNameEn) ||
    ledger.settings.shopNameTh;

  return (
    <>
      <PageHeader
        locale={locale}
        title={m.reorder.title}
        description={t('reorder.subtitle', {
          day: weekdayName(locale, ledger.settings.reorderWeekday),
        })}
      />
      {groups.length === 0 ? (
        <EmptyState
          locale={locale}
          title={m.reorder.emptyTitle}
          description={m.reorder.emptyBody}
        />
      ) : (
        <ReorderBoard
          locale={locale}
          role={role}
          shopName={shopName}
          groups={groups}
        />
      )}
    </>
  );
}
