'use client';

import type { Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Input,
  StatusBadge,
  toast,
  ts,
  type StatusTone,
} from '@peera/ui';
import {
  CircleDashed,
  PackageCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useStoreInstance } from '../client-store/hooks';
import { receiveOrder } from '../client-store/order-commands';
import type { OrderStatus } from '../domain/read-models';
import type { OrderView } from '../client-store/views';
import type { Role } from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { formatQty } from '../lib/format';

const statusStyle: Record<
  OrderStatus,
  { tone: StatusTone; icon?: LucideIcon }
> = {
  draft: { tone: 'neutral', icon: CircleDashed },
  ordered: { tone: 'info', icon: Truck },
  partial: { tone: 'warning' },
  received: { tone: 'success', icon: PackageCheck },
  cancelled: { tone: 'neutral' },
};

export function OrderStatusBadge({
  status,
  locale,
}: {
  status: OrderStatus;
  locale: Locale;
}) {
  const { m } = translator(locale);
  const style = statusStyle[status];
  return (
    <StatusBadge
      tone={style.tone}
      icon={style.icon}
      label={m.orderStatus[status]}
      locale={locale}
    />
  );
}

/** Receive a delivery against an order (02 §3.1 item 5); partial quantities keep the order open. */
export function ReceiveForm({
  locale,
  order,
  role,
}: {
  locale: Locale;
  order: OrderView;
  role: Role;
}) {
  const store = useStoreInstance();
  const { t, m } = translator(locale);
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const open = order.items.filter((line) => line.qtyBase > line.receivedBase);

  const amount = (lineId: string) => {
    const value = Math.round(Number(values[lineId]?.replace(/,/g, '') ?? 0));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const invalid = open.some(
    (line) => amount(line.lineId) > line.qtyBase - line.receivedBase,
  );
  const total = open.reduce((sum, line) => sum + amount(line.lineId), 0);

  const save = async () => {
    setSaving(true);
    const result = store
      ? await receiveOrder(
          store,
          order.id,
          open.map((line) => ({
            lineId: line.lineId,
            qtyBase: amount(line.lineId),
          })),
          role,
        )
      : null;
    setSaving(false);
    if (!result?.ok) {
      toast({
        title: t(
          (result?.error.messageKey ??
            'errors.unexpected') as 'errors.unexpected',
        ),
      });
      return;
    }
    toast({ title: t('orders.receivedToast', { number: order.number }) });
    setValues({});
    router.refresh();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {open.length > 0 ? (
        <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
          {m.orders.receiveHint}
        </p>
      ) : null}
      <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-sm border border-line bg-surface-raised p-0">
        {order.items.map((line) => {
          const remaining = line.qtyBase - line.receivedBase;
          const name = nameIn(line.item, locale);
          const over = amount(line.lineId) > remaining;
          return (
            <li
              key={line.lineId}
              className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="min-w-0">
                <p className={cn(ts('ui', locale), 'm-0 text-ink')}>{name}</p>
                <p
                  className={cn(
                    ts('body-sm', locale),
                    'm-0 tabular-nums text-ink-muted',
                  )}
                >
                  <span className="code">{line.item.sku}</span>
                  {` · ${m.orders.ordered} ${formatQty(line.qtyBase, line.item.baseUnit, locale)} · ${m.orders.received} ${formatQty(line.receivedBase, null, locale)} · ${m.orders.remaining} ${formatQty(remaining, null, locale)}`}
                </p>
              </div>
              {remaining > 0 ? (
                <label className="flex items-center gap-2">
                  <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                    {m.orders.receiving}
                  </span>
                  <span className="sr-only">
                    {t('orders.quantityLabel', { item: name })}
                  </span>
                  <Input
                    locale={locale}
                    inputMode="numeric"
                    value={values[line.lineId] ?? ''}
                    aria-invalid={over || undefined}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [line.lineId]: event.target.value,
                      }))
                    }
                    className="w-28 text-right tabular-nums"
                  />
                  <span className={cn(ts('body-sm', locale), 'text-ink')}>
                    {nameIn(line.item.baseUnit, locale)}
                  </span>
                </label>
              ) : (
                <OrderStatusBadge status="received" locale={locale} />
              )}
            </li>
          );
        })}
      </ul>
      {invalid ? (
        <p
          role="alert"
          className={cn(ts('body-sm', locale), 'm-0 text-danger')}
        >
          {m.errors.invalidInput}
        </p>
      ) : null}
      <div
        className={cn('flex flex-wrap gap-2', open.length === 0 && 'hidden')}
      >
        <Button
          locale={locale}
          variant="secondary"
          onClick={() =>
            setValues(
              Object.fromEntries(
                open.map((line) => [
                  line.lineId,
                  String(line.qtyBase - line.receivedBase),
                ]),
              ),
            )
          }
        >
          {m.orders.receiveAll}
        </Button>
        <Button
          locale={locale}
          type="submit"
          variant="primary"
          loading={saving}
          disabled={total === 0 || invalid}
        >
          {m.orders.saveReceipt}
        </Button>
      </div>
    </form>
  );
}
