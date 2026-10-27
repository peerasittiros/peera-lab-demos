'use client';

import { formatPhone, type Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Field,
  Input,
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
  removeMasterRecord,
  saveSupplier,
} from '../client-store/master-commands';
import { useStoreInstance } from '../client-store/hooks';
import type { SupplierView } from '../client-store/views';
import { translator } from '../i18n';

function displayPhone(phone: string | null) {
  if (!phone) return '';
  try {
    return formatPhone(phone);
  } catch {
    return phone;
  }
}

/** Add, edit or remove a supplier in a sheet (02 §3.1 item 10). A supplier in use cannot be removed. */
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
  const [removing, setRemoving] = useState(false);
  const store = useStoreInstance();

  const remove = async () => {
    if (!store || !supplier) return;
    setRemoving(true);
    const result = await removeMasterRecord(
      store,
      'supplier',
      supplier.id,
      'owner',
    );
    setRemoving(false);
    if (result.ok) {
      toast({ title: m.settings.removed });
      setOpen(false);
      return;
    }
    // Inside the sheet: while it is open, everything behind it (the toasts too) is hidden from screen readers.
    setErrors({
      remove: t(
        (result.error.messageKey ?? 'errors.unexpected') as 'errors.unexpected',
      ),
    });
  };

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
              {supplier ? (
                <Button
                  locale={locale}
                  variant="ghost"
                  loading={removing}
                  onClick={() => void remove()}
                >
                  <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                  {m.common.remove}
                </Button>
              ) : null}
            </div>
            {errors.remove ? (
              <p
                role="alert"
                className={cn(ts('body-sm', locale), 'm-0 text-danger')}
              >
                {errors.remove}
              </p>
            ) : null}
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
