'use client';

import type { Locale } from '@peera/i18n';
import { cn, Skeleton, ts } from '@peera/ui';
import { useStoreState } from '../client-store/hooks';
import { categoryViews, unitViews } from '../client-store/views';
import { translator } from '../i18n';
import { MasterList, ShopSettingsForm } from './MasterData';
import { PageHeader, SectionTitle } from './PageHeader';

/** Shop settings, categories and units (02 §8 owner screen). Reads and writes the browser store. */
export function SettingsView({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const { ledger, status } = useStoreState();
  const s = m.settings;
  const section = 'flex flex-col gap-4 border-t border-line pt-6';

  if (!ledger || status === 'loading')
    return <Skeleton locale={locale} lines={8} />;
  const items = Object.values(ledger.entities.item);
  const categories = categoryViews(ledger);
  const units = unitViews(ledger);

  return (
    <>
      <PageHeader locale={locale} title={s.title} description={s.subtitle} />
      <div className="flex flex-col gap-8">
        <section aria-labelledby="shop-title" className="flex flex-col gap-4">
          <SectionTitle locale={locale} id="shop-title">
            {s.shop}
          </SectionTitle>
          <ShopSettingsForm locale={locale} settings={ledger.settings} />
        </section>
        <section aria-labelledby="categories-title" className={section}>
          <div>
            <SectionTitle locale={locale} id="categories-title">
              {s.categories}
            </SectionTitle>
            <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
              {s.categoriesHint}
            </p>
          </div>
          <MasterList
            locale={locale}
            kind="category"
            records={categories.map((entry) => ({
              ...entry,
              uses: items.filter((row) => row.categoryId === entry.id).length,
            }))}
          />
        </section>
        <section aria-labelledby="units-title" className={section}>
          <div>
            <SectionTitle locale={locale} id="units-title">
              {s.units}
            </SectionTitle>
            <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
              {s.unitsHint}
            </p>
          </div>
          <MasterList
            locale={locale}
            kind="unit"
            records={units.map((entry) => ({
              ...entry,
              uses: items.filter(
                (row) =>
                  row.baseUnitId === entry.id ||
                  (row.packs as { unitId: string }[]).some(
                    (pack) => pack.unitId === entry.id,
                  ),
              ).length,
            }))}
          />
        </section>
      </div>
    </>
  );
}
