'use client';

import {
  formatDate,
  formatMoney,
  formatNumber,
  type Locale,
} from '@peera/i18n';
import { cn, focusRing, KpiTile, Skeleton, ts } from '@peera/ui';
import { dashboardView } from '../client-store/dashboard';
import { useStoreState } from '../client-store/hooks';
import { AppLink } from './AppLink';
import {
  ChartCard,
  OutflowBars,
  OutflowTable,
  ValueLineChart,
  ValueTable,
} from './Charts';
import { PageHeader, SectionTitle } from './PageHeader';
import { buttonLink } from './styles';
import { nameIn, translator } from '../i18n';
import { formatQty } from '../lib/format';

/** The owner dashboard (02 §8 screen 7): KPIs, two charts with table views, shrinkage and the order preview. */
export function DashboardView({ locale }: { locale: Locale }) {
  const { t, tp, m } = translator(locale);
  const { ledger, status } = useStoreState();

  // The title is in the server HTML; the subtitle needs the shop's data, so it comes with the body.
  if (!ledger || status === 'loading')
    return (
      <>
        <PageHeader locale={locale} title={m.dashboard.title} />
        <Skeleton locale={locale} lines={8} />
      </>
    );
  const data = dashboardView(ledger, ledger.settings.lowStockRule);
  const points = data.series.map((point) => ({
    date: point.date.toISOString(),
    value: point.value,
  }));
  const bars = data.topOutflow.map((entry) => ({
    id: entry.item.id,
    label: nameIn(entry.item, locale),
    quantityLabel: formatQty(entry.quantity, entry.item.baseUnit, locale),
    value: entry.value,
  }));
  const shopName =
    (locale === 'en' && ledger.settings.shopNameEn) ||
    ledger.settings.shopNameTh;

  return (
    <>
      <PageHeader
        locale={locale}
        title={m.dashboard.title}
        description={`${shopName} · ${m.dashboard.subtitle}`}
      />
      <div className="kpi-num grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          locale={locale}
          label={m.dashboard.kpi.lowOut}
          value={
            <AppLink
              href={`/${locale}/reorder`}
              className={cn(
                'text-ink underline-offset-4 hover:underline',
                focusRing,
              )}
            >
              {formatNumber(data.kpis.low + data.kpis.out, locale)}
            </AppLink>
          }
        />
        <KpiTile
          locale={locale}
          label={m.dashboard.kpi.value}
          value={formatMoney(data.kpis.value, locale)}
        />
        <KpiTile
          locale={locale}
          label={m.dashboard.kpi.movementsToday}
          value={formatNumber(data.kpis.movementsToday, locale)}
        />
        <KpiTile
          locale={locale}
          label={m.dashboard.kpi.lastCount}
          value={
            data.kpis.lastCountAt
              ? formatDate(data.kpis.lastCountAt, locale)
              : m.dashboard.kpi.never
          }
        />
      </div>
      <p className={cn(ts('body-sm', locale), 'mt-2 mb-6 text-ink-muted')}>
        {t('dashboard.kpi.lowOutValue', {
          low: data.kpis.low,
          out: data.kpis.out,
        })}
      </p>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          id="value"
          locale={locale}
          title={m.dashboard.valueChart}
          table={<ValueTable locale={locale} points={points} />}
        >
          <ValueLineChart locale={locale} points={points} />
        </ChartCard>
        <ChartCard
          id="outflow"
          locale={locale}
          title={m.dashboard.outflowChart}
          table={<OutflowTable locale={locale} bars={bars} />}
        >
          <OutflowBars locale={locale} bars={bars} />
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section
          aria-labelledby="shrinkage-title"
          className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4 md:p-5"
        >
          <SectionTitle locale={locale} id="shrinkage-title">
            {m.dashboard.shrinkage}
          </SectionTitle>
          {data.shrinkage.value > 0 ? (
            <>
              <p
                className={cn(
                  ts('headline-sm', locale),
                  'm-0 tabular-nums text-ink',
                )}
              >
                {formatMoney(data.shrinkage.value, locale)}
              </p>
              <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
                {tp('dashboard.shrinkageItems', data.shrinkage.items)}
              </p>
            </>
          ) : (
            <p className={cn(ts('body', locale), 'm-0 text-ink-muted')}>
              {m.dashboard.shrinkageNone}
            </p>
          )}
          <AppLink
            href={`/${locale}/counts`}
            className={cn(
              ts('ui', locale),
              'mt-auto inline-flex min-h-11 items-center text-ink underline',
            )}
          >
            {m.nav.counts}
          </AppLink>
        </section>

        <section
          aria-labelledby="order-title"
          className="flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-4 md:p-5"
        >
          <SectionTitle locale={locale} id="order-title">
            {m.dashboard.toOrder}
          </SectionTitle>
          {data.toOrder.length === 0 ? (
            <p className={cn(ts('body', locale), 'm-0 text-ink-muted')}>
              {m.dashboard.toOrderEmpty}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
              {data.toOrder.slice(0, 6).map((line) => (
                <li
                  key={line.itemId}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
                >
                  <span className="min-w-0">
                    <span className={cn(ts('ui', locale), 'block text-ink')}>
                      {nameIn(line, locale)}
                    </span>
                    <span
                      className={cn(
                        ts('body-sm', locale),
                        'block text-ink-muted',
                      )}
                    >
                      {line.supplierName ?? m.common.noSupplier}
                    </span>
                  </span>
                  <span
                    className={cn(
                      ts('body-sm', locale),
                      'tabular-nums text-ink',
                    )}
                  >
                    {`${formatQty(line.onHand, line.baseUnit, locale)} → ${formatQty(line.suggested, line.baseUnit, locale)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <AppLink
            href={`/${locale}/reorder`}
            className={buttonLink(locale, 'primary', 'self-start')}
          >
            {m.dashboard.seeReorder}
          </AppLink>
        </section>
      </div>
    </>
  );
}
