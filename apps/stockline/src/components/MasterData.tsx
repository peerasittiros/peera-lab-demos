'use client';

import { formatPhone, type Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Field,
  Input,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Textarea,
  toast,
  ts,
} from '@peera/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  addCategory,
  addUnit,
  removeMasterRecord,
  saveSettings,
  saveSupplier,
} from '../client-store/master-commands';
import { useStoreInstance } from '../client-store/hooks';
import type { Settings as ShopSettings } from '../client-store/ops';
import type { SupplierView } from '../client-store/views';
import { nameIn, translator, weekdayName } from '../i18n';
import { ChipGroup } from './ChipGroup';

function displayPhone(phone: string | null) {
  if (!phone) return '';
  try {
    return formatPhone(phone);
  } catch {
    return phone;
  }
}

/** Add or edit a supplier in a sheet (02 §3.1 item 10). */
export function SupplierEditor({
  locale,
  supplier,
}: {
  locale: Locale;
  supplier?: SupplierView;
}) {
  const { t, m } = translator(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const f = m.suppliers.form;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const store = useStoreInstance();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    if (!name) {
      setErrors({ name: m.errors.nameRequired });
      return;
    }
    setSaving(true);
    const result = store
      ? await saveSupplier(
          store,
          {
            id: supplier?.id,
            name,
            contactName: String(data.get('contactName') ?? ''),
            phone: String(data.get('phone') ?? ''),
            lineId: String(data.get('lineId') ?? ''),
            leadTimeDays: Math.max(
              0,
              Math.round(Number(data.get('leadTimeDays') ?? 0) || 0),
            ),
            note: String(data.get('note') ?? ''),
          },
          'owner',
        )
      : null;
    setSaving(false);
    if (!result) return;
    if (!result.ok) {
      const message = t(result.error.messageKey as 'errors.unexpected');
      if (result.error.code === 'phone_invalid') setErrors({ phone: message });
      else toast({ title: message });
      return;
    }
    toast({ title: m.suppliers.saved });
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      {supplier ? (
        <Button
          locale={locale}
          variant="ghost"
          size="sm"
          aria-label={t('suppliers.edit', { name: supplier.name })}
          onClick={() => {
            setKey((value) => value + 1);
            setErrors({});
            setOpen(true);
          }}
        >
          <Pencil aria-hidden size={16} strokeWidth={1.75} />
          {m.common.edit}
        </Button>
      ) : (
        <Button
          locale={locale}
          variant="primary"
          onClick={() => {
            setKey((value) => value + 1);
            setErrors({});
            setOpen(true);
          }}
        >
          <Plus aria-hidden size={16} strokeWidth={1.75} />
          {m.suppliers.add}
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent locale={locale}>
          <SheetTitle locale={locale}>
            {supplier
              ? t('suppliers.edit', { name: supplier.name })
              : m.suppliers.newTitle}
          </SheetTitle>
          <SheetDescription locale={locale}>
            {m.suppliers.subtitle}
          </SheetDescription>
          <form
            key={key}
            onSubmit={submit}
            noValidate
            className="mt-5 flex flex-col gap-4"
          >
            <Field locale={locale} label={f.name} required error={errors.name}>
              <Input
                name="name"
                defaultValue={supplier?.name}
                maxLength={120}
              />
            </Field>
            <Field
              locale={locale}
              label={`${f.contactName} (${m.common.optional})`}
            >
              <Input
                name="contactName"
                defaultValue={supplier?.contactName ?? ''}
                maxLength={120}
              />
            </Field>
            <Field
              locale={locale}
              label={`${f.phone} (${m.common.optional})`}
              hint={f.phoneHint}
              error={errors.phone}
            >
              <Input
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={displayPhone(supplier?.phone ?? null)}
                maxLength={30}
              />
            </Field>
            <Field locale={locale} label={`${f.lineId} (${m.common.optional})`}>
              <Input
                name="lineId"
                defaultValue={supplier?.lineId ?? ''}
                maxLength={60}
              />
            </Field>
            <Field locale={locale} label={f.leadTime} hint={f.leadTimeHint}>
              <Input
                name="leadTimeDays"
                inputMode="numeric"
                defaultValue={String(supplier?.leadTimeDays ?? 2)}
                className="w-28"
              />
            </Field>
            <Field locale={locale} label={`${f.note} (${m.common.optional})`}>
              <Textarea
                name="note"
                rows={3}
                defaultValue={supplier?.note ?? ''}
                maxLength={500}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                locale={locale}
                type="submit"
                variant="primary"
                loading={saving}
              >
                {m.common.save}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ShopSettingsForm({
  locale,
  settings,
}: {
  locale: Locale;
  settings: ShopSettings;
}) {
  const { m } = translator(locale);
  const router = useRouter();
  const [values, setValues] = useState({
    shopNameTh: settings.shopNameTh,
    shopNameEn: settings.shopNameEn ?? '',
    lowStockRule: settings.lowStockRule as string,
    reorderWeekday: String(settings.reorderWeekday),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const store = useStoreInstance();
  const s = m.settings;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.shopNameTh.trim()) {
      setError(m.errors.nameRequired);
      return;
    }
    setSaving(true);
    const result = store
      ? await saveSettings(
          store,
          {
            shopNameTh: values.shopNameTh,
            shopNameEn: values.shopNameEn,
            lowStockRule: values.lowStockRule as 'at_or_below_min',
            reorderWeekday: Number(values.reorderWeekday),
          },
          'owner',
        )
      : null;
    setSaving(false);
    toast({ title: result?.ok ? s.saved : m.errors.unexpected });
    router.refresh();
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-[40rem] flex-col gap-4"
    >
      <Field
        locale={locale}
        label={s.shopNameTh}
        required
        error={error ?? undefined}
      >
        <Input
          lang="th"
          value={values.shopNameTh}
          maxLength={120}
          onChange={(event) =>
            setValues({ ...values, shopNameTh: event.target.value })
          }
        />
      </Field>
      <Field locale={locale} label={`${s.shopNameEn} (${m.common.optional})`}>
        <Input
          lang="en"
          value={values.shopNameEn}
          maxLength={120}
          onChange={(event) =>
            setValues({ ...values, shopNameEn: event.target.value })
          }
        />
      </Field>
      <ChipGroup
        locale={locale}
        legend={s.lowStockRule}
        value={values.lowStockRule}
        onChange={(value) => setValues({ ...values, lowStockRule: value })}
        chips={[
          { value: 'at_or_below_min', label: s.ruleAtOrBelow },
          { value: 'below_min', label: s.ruleBelow },
        ]}
      />
      <Field
        locale={locale}
        label={s.reorderDay}
        hint={s.reorderDayHint}
        className="max-w-[16rem]"
      >
        <Select
          locale={locale}
          value={values.reorderWeekday}
          onValueChange={(value) =>
            setValues({ ...values, reorderWeekday: value })
          }
          options={[1, 2, 3, 4, 5, 6, 7].map((day) => ({
            value: String(day),
            label: weekdayName(locale, day),
          }))}
        />
      </Field>
      <div>
        <Button
          locale={locale}
          type="submit"
          variant="primary"
          loading={saving}
        >
          {s.saveShop}
        </Button>
      </div>
    </form>
  );
}

type Record_ = {
  id: string;
  nameTh: string;
  nameEn: string | null;
  symbol?: string;
  uses: number;
};

/** Categories or units: a list with usage counts, an add row, and remove for unused ones. */
export function MasterList({
  locale,
  kind,
  records,
}: {
  locale: Locale;
  kind: 'category' | 'unit';
  records: Record_[];
}) {
  const { t, tp, m } = translator(locale);
  const router = useRouter();
  const s = m.settings;
  const [draft, setDraft] = useState({ nameTh: '', nameEn: '', symbol: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const store = useStoreInstance();

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.nameTh.trim() || (kind === 'unit' && !draft.symbol.trim())) {
      toast({ title: m.errors.nameRequired });
      return;
    }
    setBusy('add');
    const result = !store
      ? null
      : kind === 'category'
        ? await addCategory(
            store,
            { nameTh: draft.nameTh, nameEn: draft.nameEn },
            'owner',
          )
        : await addUnit(
            store,
            {
              nameTh: draft.nameTh,
              nameEn: draft.nameEn,
              symbol: draft.symbol,
            },
            'owner',
          );
    setBusy(null);
    if (!result || !result.ok) {
      toast({
        title: t(
          (result?.error.messageKey ??
            'errors.unexpected') as 'errors.unexpected',
        ),
      });
      return;
    }
    toast({ title: kind === 'category' ? s.categoryAdded : s.unitAdded });
    setDraft({ nameTh: '', nameEn: '', symbol: '' });
    router.refresh();
  };

  const remove = async (id: string) => {
    setBusy(id);
    const result = store
      ? await removeMasterRecord(store, kind, id, 'owner')
      : null;
    setBusy(null);
    toast({
      title: result?.ok
        ? s.removed
        : t(
            (result?.error.messageKey ??
              'errors.unexpected') as 'errors.unexpected',
          ),
    });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-sm border border-line bg-surface-raised p-0">
        {records.map((record) => (
          <li
            key={record.id}
            className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
          >
            <span className="flex min-w-0 flex-col">
              <span className={cn(ts('ui', locale), 'text-ink')}>
                {nameIn(record, locale)}
                {record.symbol ? (
                  <span className="code text-ink-muted">{` · ${record.symbol}`}</span>
                ) : null}
              </span>
              <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                {tp('settings.inUse', record.uses)}
              </span>
            </span>
            {record.uses === 0 ? (
              <Button
                locale={locale}
                variant="ghost"
                size="sm"
                loading={busy === record.id}
                aria-label={`${m.common.remove} ${nameIn(record, locale)}`}
                onClick={() => void remove(record.id)}
              >
                <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                {m.common.remove}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex flex-wrap items-end gap-3">
        <Field locale={locale} label={s.nameTh} className="min-w-[9rem] flex-1">
          <Input
            lang="th"
            value={draft.nameTh}
            maxLength={60}
            onChange={(event) =>
              setDraft({ ...draft, nameTh: event.target.value })
            }
          />
        </Field>
        <Field
          locale={locale}
          label={`${s.nameEn} (${m.common.optional})`}
          className="min-w-[9rem] flex-1"
        >
          <Input
            lang="en"
            value={draft.nameEn}
            maxLength={60}
            onChange={(event) =>
              setDraft({ ...draft, nameEn: event.target.value })
            }
          />
        </Field>
        {kind === 'unit' ? (
          <Field locale={locale} label={s.symbol} className="w-28">
            <Input
              value={draft.symbol}
              maxLength={12}
              onChange={(event) =>
                setDraft({ ...draft, symbol: event.target.value })
              }
            />
          </Field>
        ) : null}
        <Button
          locale={locale}
          type="submit"
          variant="secondary"
          loading={busy === 'add'}
        >
          <Plus aria-hidden size={16} strokeWidth={1.75} />
          {kind === 'category' ? s.addCategory : s.addUnit}
        </Button>
      </form>
    </div>
  );
}
