'use client';

import { LineChatMock, useDemoHref, type ChatMessage } from '@peera/demo-kit';
import { formatPhone, type Locale } from '@peera/i18n';
import { splitIntoPacks } from '../domain/stock';
import { Button, Checkbox, cn, focusRing, Input, toast, ts } from '@peera/ui';
import { ChevronDown, Copy, Download, MessageCircle, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useStoreInstance } from '../client-store/hooks';
import { createOrders } from '../client-store/order-commands';
import { newId } from '../client-store/ids';
import { bangkokDay } from '../client-store/relativize';
import { downloadCsv } from '../lib/download';
import type { Unit } from '../domain/read-models';
import type { Role } from '../domain/stock';
import { reorderMessage } from '../domain/reorder-text';
import { nameIn, translator } from '../i18n';
import { formatQty } from '../lib/format';
import { AppLink } from './AppLink';
import { buttonLink } from './styles';

export type ReorderLineData = {
  itemId: string;
  sku: string;
  nameTh: string;
  nameEn: string | null;
  onHand: number;
  minQty: number;
  suggested: number;
  onOrder: number;
  baseUnit: Unit;
  pack: { unit: Unit; factor: number } | null;
};

export type ReorderGroupData = {
  supplier: {
    id: string;
    name: string;
    phone: string | null;
    lineId: string | null;
    leadTimeDays: number;
  } | null;
  lines: ReorderLineData[];
};

function safePhone(phone: string | null) {
  if (!phone) return null;
  try {
    return { display: formatPhone(phone), tel: formatPhone(phone, 'storage') };
  } catch {
    return { display: phone, tel: phone };
  }
}

/** This week's reorder list (02 §8 screen 3): supplier groups, editable quantities, a sticky action bar. */
export function ReorderBoard({
  locale,
  role,
  shopName,
  groups,
}: {
  locale: Locale;
  role: Role;
  shopName: string;
  groups: ReorderGroupData[];
}) {
  const { t, tp, m } = translator(locale);
  const router = useRouter();
  const href = useDemoHref();
  const owner = role === 'owner';
  const lines = useMemo(() => groups.flatMap((group) => group.lines), [groups]);
  const [selected, setSelected] = useState(
    () =>
      new Set(
        lines.filter((line) => line.onOrder === 0).map((line) => line.itemId),
      ),
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((line) => [line.itemId, String(line.suggested)]),
    ),
  );
  const [busy, setBusy] = useState<'order' | 'line' | null>(null);
  // Phones fold every supplier but the first, so the list stays short (ux-v2/stockline.md V5).
  const [folded, setFolded] = useState<Set<string>>(
    () => new Set(groups.slice(1).map((group) => group.supplier?.id ?? 'none')),
  );
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const store = useStoreInstance();

  const qty = (itemId: string) => {
    const value = Math.round(
      Number(quantities[itemId]?.replace(/,/g, '') ?? 0),
    );
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const toggle = (itemId: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(itemId);
      else next.delete(itemId);
      return next;
    });

  const chosen = groups
    .map((group) => ({
      ...group,
      lines: group.lines.filter(
        (line) => selected.has(line.itemId) && qty(line.itemId) > 0,
      ),
    }))
    .filter((group) => group.lines.length > 0);
  const messages = chosen.map((group) => ({
    supplierId: group.supplier?.id ?? null,
    supplierName: group.supplier?.name ?? m.common.noSupplier,
    text: reorderMessage({
      locale,
      shopName,
      supplierName: group.supplier?.name ?? m.common.noSupplier,
      lines: group.lines.map((line) => ({
        name: nameIn(line, locale),
        quantity: qty(line.itemId),
        baseUnit: line.baseUnit,
        pack: line.pack,
      })),
    }),
  }));
  const count = chosen.reduce((sum, group) => sum + group.lines.length, 0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        messages.map((message) => message.text).join('\n\n'),
      );
      toast({ title: m.reorder.copied });
    } catch {
      toast({ title: m.reorder.copyFailed });
    }
  };

  // "Send to LINE" is a mock: the message is shown in the chat preview and nothing leaves the browser (platform §6.3).
  const send = () => {
    setBusy('line');
    const sent: ChatMessage[] = [];
    for (const message of messages) {
      sent.push({
        id: newId(),
        from: 'shop',
        at: new Date().toISOString(),
        text: message.text,
      });
      toast({
        title: t('reorder.sentLine', { supplier: message.supplierName }),
      });
    }
    setChat((current) => [...current, ...sent]);
    setBusy(null);
  };

  const exportCsv = () => {
    const h = m.csv.reorder;
    const rows = groups.flatMap((group) =>
      group.lines.map((line) => {
        const split = line.pack
          ? splitIntoPacks(line.suggested, line.pack.factor)
          : null;
        return [
          group.supplier?.name ?? m.common.noSupplier,
          line.sku,
          nameIn(line, locale),
          line.onHand,
          line.minQty,
          line.suggested,
          nameIn(line.baseUnit, locale),
          split && line.pack && split.rest === 0
            ? `${split.packs} ${nameIn(line.pack.unit, locale)}`
            : '',
          line.onOrder || '',
        ];
      }),
    );
    downloadCsv(
      `stockline-reorder-${bangkokDay(new Date())}.csv`,
      [
        h.supplier,
        h.sku,
        h.item,
        h.onHand,
        h.minQty,
        h.suggested,
        h.unit,
        h.packs,
        h.onOrder,
      ],
      rows,
    );
  };

  const order = async () => {
    if (!store) return;
    setBusy('order');
    const result = await createOrders(
      store,
      chosen.map((group) => ({
        supplierId: group.supplier?.id ?? null,
        lines: group.lines.map((line) => ({
          itemId: line.itemId,
          qtyBase: qty(line.itemId),
        })),
      })),
      'owner',
    );
    setBusy(null);
    if (!result.ok) {
      toast({ title: t(result.error.messageKey as 'errors.unexpected') });
      return;
    }
    toast({ title: tp('reorder.ordered', result.data.created.length) });
    router.push(href(`/${locale}/orders`));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
        <div className="flex flex-col gap-5">
          {groups.map((group) => {
            const groupKey = group.supplier?.id ?? 'none';
            const isFolded = folded.has(groupKey);
            const groupSelected = group.lines.filter((line) => selected.has(line.itemId)).length;
            const phone = safePhone(group.supplier?.phone ?? null);
            const groupIds = group.lines.map((line) => line.itemId);
            const allOn = groupIds.every((id) => selected.has(id));
            const supplierName = group.supplier?.name ?? m.common.noSupplier;
            return (
              <section
                key={group.supplier?.id ?? 'none'}
                lang={locale}
                className="rounded-sm border border-line bg-surface-raised shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
                  <div className="min-w-0">
                    <h2 className={cn(ts('title', locale), 'm-0 text-ink')}>
                      {supplierName}
                    </h2>
                    <p
                      className={cn(
                        ts('body-sm', locale),
                        'm-0 text-ink-muted',
                      )}
                    >
                      {group.supplier
                        ? t('reorder.leadTime', {
                            days: tp(
                              'common.days',
                              group.supplier.leadTimeDays,
                            ),
                          })
                        : m.reorder.noSupplierBody}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {phone ? (
                      <a
                        href={`tel:${phone.tel}`}
                        className={buttonLink(locale, 'secondary')}
                      >
                        <Phone aria-hidden size={16} strokeWidth={1.75} />
                        <span>{`${m.reorder.call} ${phone.display}`}</span>
                      </a>
                    ) : null}
                    {group.supplier?.lineId ? (
                      <span
                        className={cn(
                          ts('body-sm', locale),
                          'inline-flex min-h-11 items-center gap-1.5 text-ink-muted md:min-h-10',
                        )}
                      >
                        <MessageCircle
                          aria-hidden
                          size={16}
                          strokeWidth={1.75}
                        />
                        {t('reorder.line', { id: group.supplier.lineId })}
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  aria-expanded={!isFolded}
                  onClick={() =>
                    setFolded((current) => {
                      const next = new Set(current);
                      if (next.has(groupKey)) next.delete(groupKey);
                      else next.add(groupKey);
                      return next;
                    })
                  }
                  className={cn(
                    ts('ui', locale),
                    'flex min-h-11 w-full items-center justify-between gap-3 border-b border-line px-4 text-left text-ink md:hidden',
                    focusRing,
                  )}
                >
                  <span>
                    {tp('common.itemsCount', group.lines.length)}
                    <span className="text-ink-muted">{` · ${tp('reorder.selectedCount', groupSelected)}`}</span>
                  </span>
                  <ChevronDown
                    aria-hidden
                    size={18}
                    strokeWidth={1.75}
                    className={cn('shrink-0 transition-transform', !isFolded && 'rotate-180')}
                  />
                </button>
                <div className={cn('border-b border-line px-4 py-2', isFolded && 'max-md:hidden')}>
                  <Checkbox
                    locale={locale}
                    label={t('reorder.selectGroup', { supplier: supplierName })}
                    checked={allOn}
                    onCheckedChange={(checked) =>
                      groupIds.forEach((id) => toggle(id, checked))
                    }
                  />
                </div>
                <ul className={cn('m-0 flex list-none flex-col divide-y divide-line p-0', isFolded && 'max-md:hidden')}>
                  {group.lines.map((line) => {
                    const amount = qty(line.itemId);
                    const name = nameIn(line, locale);
                    return (
                      <li
                        key={line.itemId}
                        className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <Checkbox
                            locale={locale}
                            label={<span className="sr-only">{name}</span>}
                            checked={selected.has(line.itemId)}
                            onCheckedChange={(checked) =>
                              toggle(line.itemId, checked)
                            }
                          />
                          <div className="min-w-0">
                            <AppLink
                              href={`/${locale}/items/${line.itemId}`}
                              className={cn(
                                ts('ui', locale),
                                'text-ink underline-offset-4 hover:underline',
                                focusRing,
                              )}
                            >
                              {name}
                            </AppLink>
                            <p
                              className={cn(
                                ts('body-sm', locale),
                                'm-0 tabular-nums text-ink-muted',
                              )}
                            >
                              <span className="code">{line.sku}</span>
                              {` · ${m.reorder.columns.onHand} ${formatQty(line.onHand, line.baseUnit, locale)} · ${m.reorder.columns.min} ${formatQty(line.minQty, null, locale)}`}
                            </p>
                            {line.onOrder > 0 ? (
                              <p
                                className={cn(
                                  ts('body-sm', locale),
                                  'm-0 text-info',
                                )}
                              >
                                {t('reorder.onOrder', {
                                  qty: formatQty(
                                    line.onOrder,
                                    line.baseUnit,
                                    locale,
                                  ),
                                })}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:items-end">
                          <label className="flex items-center gap-2">
                            <span className="sr-only">
                              {t('reorder.quantityLabel', { item: name })}
                            </span>
                            <Input
                              locale={locale}
                              inputMode="numeric"
                              value={quantities[line.itemId] ?? ''}
                              onChange={(event) =>
                                setQuantities((current) => ({
                                  ...current,
                                  [line.itemId]: event.target.value,
                                }))
                              }
                              className="w-28 text-right tabular-nums"
                            />
                            <span
                              className={cn(ts('body-sm', locale), 'text-ink')}
                            >
                              {nameIn(line.baseUnit, locale)}
                            </span>
                          </label>
                          <span
                            className={cn(
                              ts('body-sm', locale),
                              'tabular-nums text-ink-muted',
                            )}
                          >
                            {line.pack &&
                            amount > 0 &&
                            amount % line.pack.factor === 0
                              ? `= ${formatQty(amount / line.pack.factor, line.pack.unit, locale)} · `
                              : ''}
                            {t('reorder.suggestedHint', {
                              qty: formatQty(line.suggested, null, locale),
                            })}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <aside
          aria-labelledby="preview-title"
          className="flex flex-col gap-4 xl:sticky xl:top-16 xl:self-start"
        >
          <h2
            id="preview-title"
            className={cn(ts('title', locale), 'm-0 text-ink')}
          >
            {m.reorder.preview}
          </h2>
          {messages.length === 0 ? (
            <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
              {m.errors.nothingSelected}
            </p>
          ) : (
            messages.map((message) => (
              <figure
                key={message.supplierId ?? 'none'}
                className="m-0 rounded-sm border border-line bg-surface-raised p-4"
              >
                <figcaption
                  className={cn(ts('body-sm', locale), 'mb-2 text-ink-muted')}
                >
                  {t('reorder.previewFor', { supplier: message.supplierName })}
                </figcaption>
                <pre
                  className={cn(
                    ts('body-sm', locale),
                    'm-0 font-sans whitespace-pre-wrap text-ink',
                  )}
                >
                  {message.text}
                </pre>
              </figure>
            ))
          )}
          {chat.length > 0 ? (
            <LineChatMock locale={locale} shopName={shopName} messages={chat} />
          ) : null}
        </aside>
      </div>

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-line bg-surface-raised px-4 py-3 shadow-lift md:bottom-0 md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <p
            role="status"
            className={cn(ts('ui', locale), 'm-0 mr-auto text-ink')}
          >
            {tp('reorder.selectedCount', count)}
          </p>
          <Button
            locale={locale}
            size="sm"
            variant="secondary"
            disabled={count === 0}
            onClick={() => void copy()}
          >
            <Copy aria-hidden size={16} strokeWidth={1.75} />
            <span className="max-sm:sr-only">{m.reorder.copyText}</span>
          </Button>
          {owner ? (
            <Button
              locale={locale}
              size="sm"
              variant="secondary"
              disabled={count === 0}
              loading={busy === 'line'}
              onClick={() => void send()}
            >
              <MessageCircle aria-hidden size={16} strokeWidth={1.75} />
              <span className="max-sm:sr-only">{m.reorder.sendLine}</span>
            </Button>
          ) : null}
          <Button locale={locale} variant="ghost" size="sm" onClick={exportCsv}>
            <Download aria-hidden size={16} strokeWidth={1.75} />
            <span className="max-sm:sr-only">{m.common.exportCsv}</span>
          </Button>
          {owner ? (
            <Button
              locale={locale}
              variant="primary"
              disabled={count === 0}
              loading={busy === 'order'}
              onClick={() => void order()}
            >
              {m.reorder.markOrdered}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
