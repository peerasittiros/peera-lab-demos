'use client';

import type { Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Field,
  focusRing,
  Input,
  Textarea,
  toast,
} from '@peera/ui';
import { Building2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { actUpdateBuilding } from '@/src/client-store/commands/property';
import { actSaveSetting } from '@/src/client-store/commands/settings';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import type { Row } from '@/src/client-store/schema';
import { SETTING } from '@/src/client-store/setting-keys';
import { commandContext, messageFor } from '@/src/components/live/OwnerEdits';
import { ReadyGate } from '@/src/components/live/ReadyGate';
import { ImageInput } from '@/src/components/ImageInput';
import { PageHeader } from '@/src/components/PageHeader';
import { translator } from '@/src/i18n';
import { buildingsView, settingsValuesView } from './selectors';

/**
 * The building page (ux-v2/rentroll.md › Settings): the logo and the phone kept in this browser, then the names,
 * address and PromptPay ID of each building. The logo is cropped to a square and stored as WebP by `ImageInput`.
 */
export function BuildingSettings({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <Body locale={locale} />
    </ReadyGate>
  );
}

function Body({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const buildings = useStore(buildingsView);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];

  return (
    <>
      <PageHeader
        locale={locale}
        title={m.settings.pages.building.title}
        description={m.settings.pages.building.body}
      />
      <div className="flex max-w-[40rem] flex-col gap-8">
        <PropertyForm locale={locale} />
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-ink">{m.property.buildings.title}</h2>
          {buildings.length > 1 ? (
            <div
              role="group"
              aria-label={m.property.rooms.building}
              className="flex flex-wrap gap-2"
            >
              {buildings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={b.id === building?.id}
                  onClick={() => setBuildingId(b.id)}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-sm border px-3 text-ink',
                    b.id === building?.id
                      ? 'border-ink bg-surface-sunken'
                      : 'border-line bg-surface-raised',
                    focusRing,
                  )}
                >
                  {locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh)}
                </button>
              ))}
            </div>
          ) : null}
          {building ? (
            <BuildingForm
              key={building.id}
              locale={locale}
              building={building}
            />
          ) : null}
        </section>
      </div>
    </>
  );
}

/** The logo and the phone: one property, kept in this browser rather than in the snapshot. */
function PropertyForm({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const s = m.settings;
  const role = useRole();
  const values = useStore(settingsValuesView);
  const [logo, setLogo] = useState(values.logoUrl);
  const [phone, setPhone] = useState(values.phone ?? '');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ctx = commandContext(role);
    const results = [
      await actSaveSetting(ctx, { key: SETTING.logo, value: logo }),
      await actSaveSetting(ctx, {
        key: SETTING.phone,
        value: phone.trim() === '' ? null : phone,
      }),
    ];
    const failed = results.find((result) => !result.ok);
    toast({
      title: failed && !failed.ok ? messageFor(m, failed.error) : s.saved,
    });
  };

  return (
    <form
      onSubmit={submit}
      lang={locale}
      className="flex flex-col gap-4 rounded-md border border-line bg-surface-raised p-4"
    >
      <h2 className="m-0 text-ink">{s.propertyTitle}</h2>
      <ImageInput
        locale={locale}
        label={s.logo}
        hint={s.logoHint}
        value={logo}
        onChange={setLogo}
        size={256}
        placeholder={Building2}
      />
      <Field
        locale={locale}
        label={s.phone}
        hint={s.phoneHint}
        className="max-w-[20rem]"
      >
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          maxLength={30}
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>
      <div>
        <Button locale={locale} type="submit" variant="primary">
          {m.common.save}
        </Button>
      </div>
    </form>
  );
}

/** One building's names, address and PromptPay ID. The billing days live on the Billing page. */
function BuildingForm({
  locale,
  building,
}: {
  locale: Locale;
  building: Row<'building'>;
}) {
  const { m } = translator(locale);
  const s = m.settings;
  const p = m.property.buildings;
  const role = useRole();
  const [nameTh, setNameTh] = useState(building.nameTh);
  const [nameEn, setNameEn] = useState(building.nameEn ?? '');
  const [addressTh, setAddressTh] = useState(building.addressTh ?? '');
  const [addressEn, setAddressEn] = useState(building.addressEn ?? '');
  const [promptpayId, setPromptpayId] = useState(building.promptpayId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await actUpdateBuilding(commandContext(role), {
      buildingId: building.id,
      nameTh,
      nameEn: nameEn.trim() === '' ? null : nameEn,
      addressTh: addressTh.trim() === '' ? null : addressTh,
      addressEn: addressEn.trim() === '' ? null : addressEn,
      promptpayId,
      billingDay: building.billingDay,
      dueDay: building.dueDay,
    });
    toast({ title: result.ok ? s.saved : messageFor(m, result.error) });
  };

  return (
    <form
      onSubmit={submit}
      lang={locale}
      className="flex flex-col gap-4 rounded-md border border-line bg-surface-raised p-4"
    >
      <Field locale={locale} label={p.nameTh} required>
        <Input
          lang="th"
          value={nameTh}
          maxLength={120}
          required
          onChange={(event) => setNameTh(event.target.value)}
        />
      </Field>
      <Field locale={locale} label={p.nameEn}>
        <Input
          lang="en"
          value={nameEn}
          maxLength={120}
          onChange={(event) => setNameEn(event.target.value)}
        />
      </Field>
      <Field locale={locale} label={p.addressTh}>
        <Textarea
          lang="th"
          rows={2}
          maxLength={200}
          value={addressTh}
          onChange={(event) => setAddressTh(event.target.value)}
        />
      </Field>
      <Field locale={locale} label={p.addressEn}>
        <Textarea
          lang="en"
          rows={2}
          maxLength={200}
          value={addressEn}
          onChange={(event) => setAddressEn(event.target.value)}
        />
      </Field>
      <Field
        locale={locale}
        label={p.promptpayId}
        hint={p.promptpayHint}
        required
        className="max-w-[20rem]"
      >
        <Input
          value={promptpayId}
          maxLength={40}
          required
          onChange={(event) => setPromptpayId(event.target.value)}
        />
      </Field>
      <div>
        <Button locale={locale} type="submit" variant="secondary">
          {s.saveBuilding}
        </Button>
      </div>
    </form>
  );
}
