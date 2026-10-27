'use client';

import { useRole } from '../client-store/role';
import { formatDate, type Locale } from '@peera/i18n';
import { cn, EmptyState, Skeleton, ts } from '@peera/ui';
import { orderViews } from '../client-store/views';
import { useStoreState } from '../client-store/hooks';
import { translator } from '../i18n';
import { AppLink } from './AppLink';
import { OrderStatusBadge, ReceiveForm } from './OrderParts';
import { PageHeader, SectionTitle } from './PageHeader';

/** One purchase order (02 §8 screen 5b): its lines and the receive form. Reads the browser store. */
export function OrderView({ id, locale }: { id: string; locale: Locale }) {
  const role = useRole();
  const { t, m } = translator(locale);
  const { ledger, status } = useStoreState();

  if (!ledger || status === 'loading')
    return <Skeleton locale={locale} lines={6} />;
  const order = orderViews(ledger, role).find((entry) => entry.id === id);
  if (!order)
    return <EmptyState locale={locale} title={t('errors.notFound')} />;
  const open = order.status === 'ordered' || order.status === 'partial';

  return (
    <>
      <PageHeader
        locale={locale}
        eyebrow={
          <AppLink
            href={`/${locale}/orders`}
            className={cn(
              ts('ui', locale),
              'inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:underline',
            )}
          >
            {m.nav.orders}
          </AppLink>
        }
        title={t('orders.detailTitle', { number: order.number })}
        description={
          <>
            <span className="block">
              {order.supplierName ?? m.common.noSupplier}
            </span>
            {order.orderedAt ? (
              <span className="block">{`${m.orders.columns.ordered} ${formatDate(order.orderedAt, locale)}`}</span>
            ) : null}
            {order.status === 'received' && order.receivedAt ? (
              <span className="block">
                {t('orders.receivedOn', {
                  date: formatDate(order.receivedAt, locale),
                })}
              </span>
            ) : order.expectedAt ? (
              <span className="block">
                {t('orders.expectedOn', {
                  date: formatDate(order.expectedAt, locale),
                })}
              </span>
            ) : null}
          </>
        }
        actions={<OrderStatusBadge status={order.status} locale={locale} />}
      />
      {order.note ? (
        <p
          className={cn(ts('body', locale), 'mt-0 mb-6 text-ink')}
        >{`${m.orders.note}: ${order.note}`}</p>
      ) : null}
      <section
        aria-labelledby="receive-title"
        className="flex max-w-[56rem] flex-col gap-3"
      >
        <SectionTitle locale={locale} id="receive-title">
          {open ? m.orders.receive : m.orders.received}
        </SectionTitle>
        <ReceiveForm locale={locale} order={order} role={role} />
      </section>
    </>
  );
}
