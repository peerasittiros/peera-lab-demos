'use client';

import { useRole } from '../client-store/role';
import {
  formatDateTime,
  formatMoney,
  formatPercent,
  type Locale,
} from '@peera/i18n';
import { cn, EmptyState, Skeleton, ts } from '@peera/ui';
import type { ReactNode } from 'react';
import {
  changeViews,
  categoryViews,
  movementViews,
  onOrderByItem,
  supplierViews,
  unitViews,
  type ChangeView,
} from '../client-store/views';
import { useItemViews, useStoreState } from '../client-store/hooks';
import { AppLink } from './AppLink';
import { ItemForm } from './ItemForm';
import {
  ArchiveButton,
  ItemTabs,
  RecordMovementButton,
} from './ItemDetailClient';
import { ItemThumb } from './ItemRow';
import { LabelStrip } from './LabelStrip';
import { ItemStatusBadge } from './ItemStatusBadge';
import { MovementCards } from './Movements';
import { PageHeader, SectionTitle } from './PageHeader';
import { splitIntoPacks, stockValue } from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { formatQty } from '../lib/format';

const FIELD_LABELS = {
  nameTh: 'nameTh',
  nameEn: 'nameEn',
  sku: 'sku',
  barcode: 'barcode',
  categoryId: 'category',
  baseUnitId: 'baseUnit',
  packs: 'packs',
  costSatang: 'cost',
  priceSatang: 'price',
  minQty: 'minQty',
  reorderQty: 'reorderQty',
  supplierId: 'supplier',
  location: 'location',
  active: 'active',
} as const;

function Stat({
  label,
  children,
  locale,
}: {
  label: ReactNode;
  children: ReactNode;
  locale: Locale;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-line bg-surface-raised p-4">
      <dt className={cn(ts('body-sm', locale), 'text-ink-muted')}>{label}</dt>
      <dd className={cn(ts('ui', locale), 'm-0 tabular-nums text-ink')}>
        {children}
      </dd>
    </div>
  );
}

/** One item: overview, history and settings (02 §8 screen 3b). Reads the browser store. */
export function ItemDetail({ id, locale }: { id: string; locale: Locale }) {
  const role = useRole();
  const { t, m } = translator(locale);
  const { ledger, snapshot, ops, status } = useStoreState();
  const views = useItemViews(role, { includeInactive: true });

  if (!ledger || status === 'loading')
    return <Skeleton locale={locale} lines={6} />;
  const view = views.find((entry) => entry.id === id);
  if (!view) return <EmptyState locale={locale} title={t('errors.notFound')} />;

  const owner = role === 'owner';
  const categories = categoryViews(ledger);
  const suppliers = supplierViews(ledger);
  const units = unitViews(ledger);
  const history = movementViews(ledger, role, { itemId: id, limit: 30 });
  const templateRow = snapshot?.items.find((row) => String(row.id) === id);
  const baseline = templateRow
    ? {
        ...templateRow,
        packs: (snapshot?.itemUnits ?? [])
          .filter((row) => String(row.itemId) === id)
          .map((row) => ({
            unitId: String(row.unitId),
            factor: Number(row.factor),
          })),
      }
    : null;
  const audit: ChangeView[] = owner
    ? changeViews(ops, ledger.users, id, baseline)
    : [];

  const onOrder = onOrderByItem(ledger).get(id) ?? 0;
  const supplier = suppliers.find((entry) => entry.id === view.supplierId);
  const category = categories.find((entry) => entry.id === view.categoryId);
  const otherName = locale === 'en' ? view.nameTh : view.nameEn;
  const biggestPack = view.packs.at(-1);
  const split = biggestPack
    ? splitIntoPacks(view.onHand, biggestPack.factor)
    : null;
  const margin =
    owner && view.priceSatang && view.costSatang != null && view.priceSatang > 0
      ? (view.priceSatang - view.costSatang) / view.priceSatang
      : null;

  const overview = (
    <div className="flex flex-col gap-6">
      {/* The label strip marks the item's header, like the edge of a shelf label (ux-v2 motif). */}
      <LabelStrip className="rounded-sm" />
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
            {m.items.overview.onHand}
          </p>
          <p className="num m-0 text-[2.75rem] leading-tight text-ink">
            {formatQty(view.onHand, view.baseUnit, locale)}
          </p>
          {split && biggestPack && split.packs > 0 ? (
            <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
              {t('items.overview.inPacks', {
                packs: split.packs,
                pack: nameIn(biggestPack.unit, locale),
                rest: split.rest,
                base: nameIn(view.baseUnit, locale),
              })}
            </p>
          ) : null}
        </div>
        <ItemStatusBadge
          status={view.status}
          archived={!view.active}
          locale={locale}
        />
      </div>
      <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat locale={locale} label={m.items.overview.minQty}>
          {formatQty(view.minQty, view.baseUnit, locale)}
        </Stat>
        <Stat locale={locale} label={m.items.overview.reorderQty}>
          {formatQty(view.reorderQty, view.baseUnit, locale)}
        </Stat>
        <Stat locale={locale} label={m.items.overview.onOrder}>
          {formatQty(onOrder, view.baseUnit, locale)}
        </Stat>
        <Stat locale={locale} label={m.items.overview.units}>
          {view.packs.length === 0
            ? nameIn(view.baseUnit, locale)
            : view.packs.map((pack) => (
                <span key={pack.unitId} className="block">
                  {t('items.overview.packEquals', {
                    pack: nameIn(pack.unit, locale),
                    factor: pack.factor,
                    base: nameIn(view.baseUnit, locale),
                  })}
                </span>
              ))}
        </Stat>
        <Stat locale={locale} label={m.items.overview.supplier}>
          {supplier ? supplier.name : m.common.noSupplier}
        </Stat>
        <Stat locale={locale} label={m.items.overview.location}>
          {view.location ?? m.common.none}
        </Stat>
        <Stat locale={locale} label={m.items.form.category}>
          {category ? nameIn(category, locale) : m.common.noCategory}
        </Stat>
        <Stat locale={locale} label={m.items.overview.barcode}>
          <span className="code">{view.barcode ?? m.common.none}</span>
        </Stat>
      </dl>
      {owner ? (
        <section aria-labelledby="prices-title" className="flex flex-col gap-3">
          <SectionTitle locale={locale} id="prices-title">
            {m.items.overview.prices}
          </SectionTitle>
          <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat locale={locale} label={m.items.overview.cost}>
              {view.costSatang == null
                ? m.common.none
                : formatMoney(view.costSatang, locale)}
            </Stat>
            <Stat locale={locale} label={m.items.overview.price}>
              {view.priceSatang == null
                ? m.common.none
                : formatMoney(view.priceSatang, locale)}
            </Stat>
            <Stat locale={locale} label={m.items.overview.margin}>
              {margin == null
                ? m.common.none
                : formatPercent(margin, locale, 1)}
            </Stat>
            <Stat locale={locale} label={m.items.overview.value}>
              {formatMoney(
                stockValue(view.onHand, view.costSatang ?? null),
                locale,
              )}
            </Stat>
          </dl>
        </section>
      ) : null}
    </div>
  );

  const historyPanel = (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <section aria-labelledby="ledger-title" className="flex flex-col gap-3">
        <SectionTitle locale={locale} id="ledger-title">
          {m.items.history.ledger}
        </SectionTitle>
        {history.length === 0 ? (
          <EmptyState locale={locale} title={m.items.history.noMovements} />
        ) : (
          <MovementCards rows={history} locale={locale} showItem={false} />
        )}
        <AppLink
          href={`/${locale}/history?item=${id}`}
          className={cn(
            ts('ui', locale),
            'inline-flex min-h-11 items-center text-ink underline',
          )}
        >
          {m.items.history.seeAll}
        </AppLink>
      </section>
      {owner ? (
        <section
          aria-labelledby="changes-title"
          className="flex flex-col gap-3"
        >
          <SectionTitle locale={locale} id="changes-title">
            {m.items.history.changes}
          </SectionTitle>
          {audit.length === 0 ? (
            <EmptyState locale={locale} title={m.items.history.noChanges} />
          ) : (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {audit.map((event) => (
                <AuditEntry
                  key={event.id}
                  event={event}
                  locale={locale}
                  units={units}
                  lookup={{ categories, suppliers }}
                />
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );

  const settingsPanel = owner ? (
    <div className="flex flex-col gap-8">
      <ItemForm
        locale={locale}
        units={units}
        categories={categories}
        suppliers={suppliers}
        initial={{
          id: view.id,
          nameTh: view.nameTh,
          nameEn: view.nameEn ?? '',
          sku: view.sku,
          barcode: view.barcode ?? '',
          categoryId: view.categoryId ?? '',
          baseUnitId: view.baseUnit.id,
          packs: view.packs.map((pack) => ({
            unitId: pack.unitId,
            factor: String(pack.factor),
          })),
          cost: view.costSatang == null ? '' : String(view.costSatang / 100),
          price: view.priceSatang == null ? '' : String(view.priceSatang / 100),
          minQty: String(view.minQty),
          reorderQty: String(view.reorderQty),
          supplierId: view.supplierId ?? '',
          location: view.location ?? '',
          openingQty: '',
          imageUrl: view.imageUrl,
        }}
      />
      <div className="border-t border-line pt-5">
        <ArchiveButton item={view} locale={locale} />
      </div>
    </div>
  ) : undefined;

  return (
    <>
      <PageHeader
        locale={locale}
        eyebrow={
          <AppLink
            href={`/${locale}/items`}
            className={cn(
              ts('ui', locale),
              'inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:underline',
            )}
          >
            {m.nav.items}
          </AppLink>
        }
        title={
          <span className="flex items-center gap-4">
            <ItemThumb item={view} size={56} />
            <span>{nameIn(view, locale)}</span>
          </span>
        }
        description={
          <>
            {otherName ? (
              <span lang={locale === 'en' ? 'th' : 'en'} className="block">
                {otherName}
              </span>
            ) : null}
            <span className="code">{view.sku}</span>
          </>
        }
        actions={
          <RecordMovementButton item={view} locale={locale} role={role} />
        }
      />
      <ItemTabs
        locale={locale}
        overview={overview}
        history={historyPanel}
        settings={settingsPanel}
      />
    </>
  );
}

function AuditEntry({
  event,
  locale,
  units,
  lookup,
}: {
  event: ChangeView;
  locale: Locale;
  units: { id: string; nameTh: string; nameEn: string | null }[];
  lookup: {
    categories: { id: string; nameTh: string; nameEn: string | null }[];
    suppliers: { id: string; name: string }[];
  };
}) {
  const { t, m } = translator(locale);
  const show = (field: string, value: unknown): string => {
    if (value === null || value === undefined || value === '')
      return m.common.none;
    if (field === 'costSatang' || field === 'priceSatang')
      return formatMoney(Number(value), locale);
    if (field === 'categoryId')
      return (
        nameIn(
          lookup.categories.find((entry) => entry.id === value),
          locale,
        ) || m.common.unknown
      );
    if (field === 'supplierId')
      return (
        lookup.suppliers.find((entry) => entry.id === value)?.name ??
        m.common.unknown
      );
    if (field === 'baseUnitId')
      return (
        nameIn(
          units.find((entry) => entry.id === value),
          locale,
        ) || m.common.unknown
      );
    if (field === 'packs' && Array.isArray(value))
      return (
        value
          .map((pack: { unitId: string; factor: number }) =>
            t('quickMove.packUnit', {
              unit: nameIn(
                units.find((entry) => entry.id === pack.unitId),
                locale,
              ),
              factor: pack.factor,
            }),
          )
          .join(', ') || m.common.none
      );
    if (typeof value === 'boolean')
      return value ? m.items.form.active : m.status.archived;
    return String(value);
  };
  const label = (field: string) => {
    const key = FIELD_LABELS[field as keyof typeof FIELD_LABELS];
    return key
      ? ((m.items.form as Record<string, string>)[key] ?? field)
      : field;
  };
  const title =
    event.action === 'create'
      ? m.items.history.created
      : event.action === 'archive'
        ? m.items.history.archived
        : event.action === 'restore'
          ? m.items.history.restored
          : null;
  return (
    <li className="rounded-sm border border-line bg-surface-raised p-3">
      <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
        {formatDateTime(event.at, locale)}
        {event.userName
          ? ` · ${t('items.history.by', { name: event.userName })}`
          : ''}
      </p>
      {title ? (
        <p className={cn(ts('ui', locale), 'm-0 mt-1 text-ink')}>{title}</p>
      ) : (
        <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
          {Object.entries(event.diff).map(([field, change]) => (
            <li key={field} className={cn(ts('body-sm', locale), 'text-ink')}>
              <span className="font-medium">
                {t('items.history.updated', { field: label(field) })}
              </span>{' '}
              <span className="text-ink-muted">
                {t('items.history.from', {
                  before: show(field, change.before),
                  after: show(field, change.after),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
