'use client';

import { useDemoHref } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { Button, cn, Field, Input, Select, toast, ts } from '@peera/ui';
import { Package, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { saveItem } from '../client-store/master-commands';
import { useStoreInstance } from '../client-store/hooks';
import type { Named, SupplierRef, Unit } from '../domain/read-models';
import { nameIn, translator } from '../i18n';
import { ImageInput } from './ImageInput';

export type ItemFormValues = {
  id?: string;
  nameTh: string;
  nameEn: string;
  sku: string;
  barcode: string;
  categoryId: string;
  baseUnitId: string;
  packs: { unitId: string; factor: string }[];
  cost: string;
  price: string;
  minQty: string;
  reorderQty: string;
  supplierId: string;
  location: string;
  openingQty: string;
  /** The photo: an upload (data URL), a sample photo path, or null for the icon tile. */
  imageUrl: string | null;
};

const NONE = '__none__';

function toNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : Number.NaN;
}

/** Create and edit form for an item (02 §3.1 item 1). Owner only; the server checks the role again. */
export function ItemForm({
  locale,
  initial,
  units,
  categories,
  suppliers,
}: {
  locale: Locale;
  initial: ItemFormValues;
  units: Unit[];
  categories: Named[];
  suppliers: SupplierRef[];
}) {
  const { t, m } = translator(locale);
  const router = useRouter();
  const href = useDemoHref();
  const store = useStoreInstance();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial.id);
  const f = m.items.form;

  const set = <K extends keyof ItemFormValues>(
    key: K,
    value: ItemFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
  };

  const unitOptions = units.map((entry) => ({
    value: entry.id,
    label: nameIn(entry, locale),
  }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!values.nameTh.trim()) found.nameTh = m.errors.nameRequired;
    const numbers = {
      cost: toNumber(values.cost),
      price: toNumber(values.price),
      minQty: toNumber(values.minQty) ?? 0,
      reorderQty: toNumber(values.reorderQty) ?? 0,
      openingQty: toNumber(values.openingQty) ?? 0,
    };
    for (const [key, value] of Object.entries(numbers))
      if (value !== null && (Number.isNaN(value) || value < 0))
        found[key] = m.errors.invalidInput;
    const packs = values.packs
      .filter((pack) => pack.unitId)
      .map((pack) => ({ unitId: pack.unitId, factor: Number(pack.factor) }));
    if (packs.some((pack) => !Number.isInteger(pack.factor) || pack.factor < 2))
      found.packs = m.errors.invalidInput;
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    const payload = {
      nameTh: values.nameTh,
      nameEn: values.nameEn,
      sku: values.sku,
      barcode: values.barcode,
      categoryId: values.categoryId || null,
      baseUnitId: values.baseUnitId,
      packs,
      costBaht: numbers.cost,
      priceBaht: numbers.price,
      minQty: Math.round(numbers.minQty),
      reorderQty: Math.round(numbers.reorderQty),
      supplierId: values.supplierId || null,
      location: values.location,
      imageUrl: values.imageUrl,
    };
    const result = store
      ? await saveItem(
          store,
          editing
            ? { ...payload, id: initial.id }
            : { ...payload, openingQty: Math.round(numbers.openingQty) },
          'owner',
        )
      : null;
    setSaving(false);
    if (!result) return;
    if (!result.ok) {
      const message = t(result.error.messageKey as 'errors.unexpected');
      if (result.error.code === 'sku_taken') setErrors({ sku: message });
      else if (result.error.code === 'barcode_taken')
        setErrors({ barcode: message });
      toast({ title: message });
      return;
    }
    toast({ title: editing ? f.saved : f.created });
    router.push(href(`/${locale}/items/${result.data.id}`));
    router.refresh();
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-[48rem] flex-col gap-6"
    >
      <ImageInput
        locale={locale}
        label={f.photo}
        hint={f.photoHint}
        value={values.imageUrl}
        onChange={(value) => set('imageUrl', value)}
        size={320}
        placeholder={Package}
      />
      <fieldset className="m-0 grid gap-4 border-0 p-0 md:grid-cols-2">
        <Field
          locale={locale}
          label={f.nameTh}
          required
          error={errors.nameTh}
          className="md:col-span-2"
        >
          <Input
            lang="th"
            value={values.nameTh}
            maxLength={120}
            onChange={(event) => set('nameTh', event.target.value)}
          />
        </Field>
        <Field
          locale={locale}
          label={`${f.nameEn} (${m.common.optional})`}
          hint={f.nameHint}
          className="md:col-span-2"
        >
          <Input
            lang="en"
            value={values.nameEn}
            maxLength={120}
            onChange={(event) => set('nameEn', event.target.value)}
          />
        </Field>
        <Field
          locale={locale}
          label={f.sku}
          hint={editing ? undefined : f.skuHint}
          error={errors.sku}
        >
          <Input
            className="code"
            value={values.sku}
            maxLength={40}
            onChange={(event) => set('sku', event.target.value)}
          />
        </Field>
        <Field
          locale={locale}
          label={`${f.barcode} (${m.common.optional})`}
          hint={f.barcodeHint}
          error={errors.barcode}
        >
          <Input
            className="code"
            value={values.barcode}
            maxLength={64}
            inputMode="numeric"
            onChange={(event) => set('barcode', event.target.value)}
          />
        </Field>
        <Field locale={locale} label={f.category}>
          <Select
            locale={locale}
            value={values.categoryId || NONE}
            onValueChange={(value) =>
              set('categoryId', value === NONE ? '' : value)
            }
            options={[
              { value: NONE, label: m.common.noCategory },
              ...categories.map((entry) => ({
                value: entry.id,
                label: nameIn(entry, locale),
              })),
            ]}
          />
        </Field>
        <Field locale={locale} label={f.supplier}>
          <Select
            locale={locale}
            value={values.supplierId || NONE}
            onValueChange={(value) =>
              set('supplierId', value === NONE ? '' : value)
            }
            options={[
              { value: NONE, label: m.common.noSupplier },
              ...suppliers.map((entry) => ({
                value: entry.id,
                label: entry.name,
              })),
            ]}
          />
        </Field>
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-4 border-0 border-t border-line p-0 pt-5">
        <Field
          locale={locale}
          label={f.baseUnit}
          hint={f.baseUnitHint}
          required
          className="max-w-[20rem]"
        >
          <Select
            locale={locale}
            value={values.baseUnitId}
            onValueChange={(value) => set('baseUnitId', value)}
            options={unitOptions}
          />
        </Field>
        <div>
          <p className={cn(ts('ui', locale), 'm-0 text-ink')}>{f.packs}</p>
          <p className={cn(ts('body-sm', locale), 'm-0 mb-3 text-ink-muted')}>
            {f.packsHint}
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {values.packs.map((pack, index) => (
              <li key={index} className="flex flex-wrap items-end gap-3">
                <Field
                  locale={locale}
                  label={f.packUnit}
                  className="min-w-[10rem] flex-1"
                >
                  <Select
                    locale={locale}
                    value={pack.unitId}
                    placeholder={f.choose}
                    onValueChange={(value) =>
                      set(
                        'packs',
                        values.packs.map((entry, at) =>
                          at === index ? { ...entry, unitId: value } : entry,
                        ),
                      )
                    }
                    options={unitOptions.filter(
                      (option) => option.value !== values.baseUnitId,
                    )}
                  />
                </Field>
                <Field locale={locale} label={f.packFactor} className="w-32">
                  <Input
                    inputMode="numeric"
                    value={pack.factor}
                    onChange={(event) =>
                      set(
                        'packs',
                        values.packs.map((entry, at) =>
                          at === index
                            ? { ...entry, factor: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  />
                </Field>
                <Button
                  locale={locale}
                  variant="ghost"
                  aria-label={t('items.form.removePack', {
                    unit: nameIn(
                      units.find((entry) => entry.id === pack.unitId),
                      locale,
                    ),
                  })}
                  onClick={() =>
                    set(
                      'packs',
                      values.packs.filter((_, at) => at !== index),
                    )
                  }
                >
                  <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                </Button>
              </li>
            ))}
          </ul>
          {errors.packs ? (
            <p className={cn(ts('body-sm', locale), 'text-danger')}>
              {errors.packs}
            </p>
          ) : null}
          {values.packs.length < 5 ? (
            <Button
              locale={locale}
              variant="ghost"
              className="mt-2"
              onClick={() =>
                set('packs', [...values.packs, { unitId: '', factor: '' }])
              }
            >
              <Plus aria-hidden size={16} strokeWidth={1.75} />
              {f.addPack}
            </Button>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="m-0 grid gap-4 border-0 border-t border-line p-0 pt-5 md:grid-cols-2">
        <Field
          locale={locale}
          label={f.minQty}
          hint={f.minQtyHint}
          error={errors.minQty}
        >
          <Input
            inputMode="numeric"
            value={values.minQty}
            onChange={(event) => set('minQty', event.target.value)}
          />
        </Field>
        <Field
          locale={locale}
          label={f.reorderQty}
          hint={f.reorderQtyHint}
          error={errors.reorderQty}
        >
          <Input
            inputMode="numeric"
            value={values.reorderQty}
            onChange={(event) => set('reorderQty', event.target.value)}
          />
        </Field>
        <Field
          locale={locale}
          label={`${f.cost} (${m.common.optional})`}
          error={errors.cost}
        >
          <Input
            inputMode="decimal"
            value={values.cost}
            onChange={(event) => set('cost', event.target.value)}
          />
        </Field>
        <Field
          locale={locale}
          label={`${f.price} (${m.common.optional})`}
          error={errors.price}
        >
          <Input
            inputMode="decimal"
            value={values.price}
            onChange={(event) => set('price', event.target.value)}
          />
        </Field>
        <Field
          locale={locale}
          label={`${f.location} (${m.common.optional})`}
          className="md:col-span-2"
        >
          <Input
            value={values.location}
            maxLength={80}
            placeholder={f.locationPlaceholder}
            onChange={(event) => set('location', event.target.value)}
          />
        </Field>
        {editing ? null : (
          <Field
            locale={locale}
            label={f.openingQty}
            hint={f.openingHint}
            error={errors.openingQty}
          >
            <Input
              inputMode="numeric"
              value={values.openingQty}
              onChange={(event) => set('openingQty', event.target.value)}
            />
          </Field>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        <Button
          locale={locale}
          type="submit"
          variant="primary"
          loading={saving}
        >
          {editing ? m.common.save : f.create}
        </Button>
        <Button locale={locale} variant="ghost" onClick={() => router.back()}>
          {m.common.cancel}
        </Button>
      </div>
    </form>
  );
}
