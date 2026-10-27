'use client';

import { formatPhone, type Locale } from '@peera/i18n';
import { Button, Field, Input, Skeleton, Textarea, toast } from '@peera/ui';
import { Store } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useStoreInstance, useStoreState } from '../../client-store/hooks';
import { saveSettings } from '../../client-store/master-commands';
import type { Settings } from '../../client-store/ops';
import { translator } from '../../i18n';
import { ImageInput } from '../ImageInput';
import { PageHeader } from '../PageHeader';

/** Shop details: the names, the logo (kept in this browser), the phone and the address. */
export function ShopSettings({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const { ledger, status } = useStoreState();
  const page = m.settings.pages.shop;
  return (
    <>
      <PageHeader locale={locale} title={page.title} description={page.body} />
      {!ledger || status === 'loading' ? (
        <Skeleton locale={locale} lines={6} />
      ) : (
        <ShopForm locale={locale} settings={ledger.settings} />
      )}
    </>
  );
}

function displayPhone(phone: string | null) {
  if (!phone) return '';
  try {
    return formatPhone(phone);
  } catch {
    return phone;
  }
}

function ShopForm({
  locale,
  settings,
}: {
  locale: Locale;
  settings: Settings;
}) {
  const { t, m } = translator(locale);
  const s = m.settings;
  const store = useStoreInstance();
  const [values, setValues] = useState({
    shopNameTh: settings.shopNameTh,
    shopNameEn: settings.shopNameEn ?? '',
    phone: displayPhone(settings.phone),
    address: settings.address ?? '',
  });
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.shopNameTh.trim()) {
      setErrors({ shopNameTh: m.errors.nameRequired });
      return;
    }
    setErrors({});
    setSaving(true);
    const result = store
      ? await saveSettings(
          store,
          {
            shopNameTh: values.shopNameTh,
            shopNameEn: values.shopNameEn,
            phone: values.phone,
            address: values.address,
            logoUrl,
          },
          'owner',
        )
      : null;
    setSaving(false);
    if (result && !result.ok && result.error.code === 'phone_invalid') {
      setErrors({ phone: m.suppliers.form.phoneInvalid });
      return;
    }
    toast({
      title: result?.ok
        ? s.saved
        : t(
            (result?.error.messageKey ??
              'errors.unexpected') as 'errors.unexpected',
          ),
    });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-[40rem] flex-col gap-5"
    >
      <ImageInput
        locale={locale}
        label={s.logo}
        hint={s.logoHint}
        value={logoUrl}
        onChange={setLogoUrl}
        size={256}
        placeholder={Store}
      />
      <Field
        locale={locale}
        label={s.shopNameTh}
        required
        error={errors.shopNameTh}
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
      <Field
        locale={locale}
        label={`${s.phone} (${m.common.optional})`}
        hint={m.suppliers.form.phoneHint}
        error={errors.phone}
        className="max-w-[20rem]"
      >
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.phone}
          maxLength={30}
          onChange={(event) =>
            setValues({ ...values, phone: event.target.value })
          }
        />
      </Field>
      <Field locale={locale} label={`${s.address} (${m.common.optional})`}>
        <Textarea
          lang={locale}
          rows={3}
          maxLength={300}
          value={values.address}
          onChange={(event) =>
            setValues({ ...values, address: event.target.value })
          }
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
