'use client';

import type { Locale } from '@peera/i18n';
import { Skeleton } from '@peera/ui';
import { useItemFormOptions } from '../client-store/hooks';
import { ItemForm } from './ItemForm';

/** The new-item form, with the shop's units, categories and suppliers from the browser store. */
export function ItemNew({
  locale,
  barcode,
}: {
  locale: Locale;
  barcode: string;
}) {
  const { units, categories, suppliers, loaded } = useItemFormOptions();
  if (!loaded) return <Skeleton locale={locale} lines={6} />;
  return (
    <ItemForm
      locale={locale}
      units={units}
      categories={categories}
      suppliers={suppliers}
      initial={{
        nameTh: '',
        nameEn: '',
        sku: '',
        barcode,
        categoryId: '',
        baseUnitId: units[0]?.id ?? '',
        packs: [],
        cost: '',
        price: '',
        minQty: '',
        reorderQty: '',
        supplierId: '',
        location: '',
        openingQty: '',
      }}
    />
  );
}
