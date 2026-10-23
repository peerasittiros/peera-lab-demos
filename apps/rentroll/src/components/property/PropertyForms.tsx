'use client';

import type { Locale } from '@peera/i18n';
import { Button, Field, Input, Select, toast, ts } from '@peera/ui';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  addRatePlanSettings,
  saveBuildingSettings,
  saveRoomSettings,
  saveRoomTypeSettings,
  setRoomMaintenanceFlag,
} from '../../actions/property';
import { translator, type Messages } from '../../i18n';

type Failure = { ok: false; error: { messageKey: string } };
type Result = { ok: true; data: unknown } | Failure;

/** Baht typed by the user → integer satang. Empty or invalid input becomes 0 and the server rejects nothing it can't check. */
function toSatang(raw: FormDataEntryValue | null): number {
  const value = Math.round(Number(String(raw ?? '').replace(/,/g, '')) * 100);
  return Number.isFinite(value) ? value : 0;
}

function toInt(raw: FormDataEntryValue | null): number {
  const value = Math.round(Number(raw ?? 0));
  return Number.isFinite(value) ? value : 0;
}

function text(raw: FormDataEntryValue | null): string {
  return String(raw ?? '').trim();
}

function optionalText(raw: FormDataEntryValue | null): string | null {
  const value = text(raw);
  return value === '' ? null : value;
}

function failureText(m: Messages, result: Failure): string {
  const key = result.error.messageKey.split('.').pop() as keyof Messages['property']['errors'];
  return m.property.errors[key] ?? m.property.errors.saveFailed;
}

/** Shows the outcome as a toast; the caller refreshes the page on success. */
function report(m: Messages, result: Result): string | null {
  if (result.ok) {
    toast({ title: m.property.saved });
    return null;
  }
  const message = failureText(m, result);
  toast({ title: message });
  return message;
}

function useSaving() {
  const [saving, setSaving] = useState(false);
  return { saving, setSaving };
}

export type BuildingValues = {
  id: string;
  nameTh: string;
  nameEn: string | null;
  addressTh: string | null;
  addressEn: string | null;
  promptpayId: string;
  bankName: string | null;
  bankAccountMasked: string | null;
  billingDay: number;
  dueDay: number;
  invoiceYearStyle: 'be' | 'ce';
};

export function BuildingForm({ locale, building }: { locale: Locale; building: BuildingValues }) {
  const { m } = translator(locale);
  const router = useRouter();
  const { saving, setSaving } = useSaving();
  const [error, setError] = useState<string | null>(null);
  const p = m.property.buildings;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    const result = await saveBuildingSettings({
      buildingId: building.id,
      nameTh: text(data.get('nameTh')),
      nameEn: optionalText(data.get('nameEn')),
      addressTh: optionalText(data.get('addressTh')),
      addressEn: optionalText(data.get('addressEn')),
      promptpayId: text(data.get('promptpayId')),
      bankName: optionalText(data.get('bankName')),
      bankAccountMasked: optionalText(data.get('bankAccountMasked')),
      billingDay: toInt(data.get('billingDay')),
      dueDay: toInt(data.get('dueDay')),
      invoiceYearStyle: data.get('invoiceYearStyle') === 'ce' ? 'ce' : 'be',
    });
    setSaving(false);
    setError(report(m, result));
    if (result.ok) router.refresh();
  };

  return (
    <form onSubmit={submit} lang={locale} className="grid gap-4 md:grid-cols-2">
      <Field label={p.nameTh} locale={locale} required>
        <Input name="nameTh" defaultValue={building.nameTh} required />
      </Field>
      <Field label={p.nameEn} locale={locale}>
        <Input name="nameEn" defaultValue={building.nameEn ?? ''} />
      </Field>
      <Field label={p.addressTh} locale={locale}>
        <Input name="addressTh" defaultValue={building.addressTh ?? ''} />
      </Field>
      <Field label={p.addressEn} locale={locale}>
        <Input name="addressEn" defaultValue={building.addressEn ?? ''} />
      </Field>
      <Field label={p.promptpayId} hint={p.promptpayHint} locale={locale} required>
        <Input name="promptpayId" defaultValue={building.promptpayId} required />
      </Field>
      <Field label={p.bankName} locale={locale}>
        <Input name="bankName" defaultValue={building.bankName ?? ''} />
      </Field>
      <Field label={p.bankAccountMasked} locale={locale}>
        <Input name="bankAccountMasked" defaultValue={building.bankAccountMasked ?? ''} />
      </Field>
      <Field label={p.invoiceYearStyle} locale={locale}>
        <Select
          locale={locale}
          name="invoiceYearStyle"
          defaultValue={building.invoiceYearStyle}
          options={[
            { value: 'be', label: p.yearBe },
            { value: 'ce', label: p.yearCe },
          ]}
        />
      </Field>
      <Field label={p.billingDay} locale={locale} required>
        <Input name="billingDay" type="number" inputMode="numeric" min={1} max={28} defaultValue={building.billingDay} required />
      </Field>
      <Field label={p.dueDay} locale={locale} required>
        <Input name="dueDay" type="number" inputMode="numeric" min={1} max={28} defaultValue={building.dueDay} required />
      </Field>
      {error ? (
        <p role="alert" className={`${ts('body', locale)} text-danger md:col-span-2`}>
          {error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" variant="primary" locale={locale} loading={saving}>
          {p.save}
        </Button>
      </div>
    </form>
  );
}

export type RoomTypeValues = {
  id: string;
  nameTh: string;
  nameEn: string | null;
  monthlyRentSatang: number;
  dailyRentSatang: number | null;
  depositSatang: number;
  advanceMonths: number;
};

/** Edits an existing room type when `roomType` is given, otherwise adds one for `buildingId`. */
export function RoomTypeForm({
  locale,
  buildingId,
  roomType,
}: {
  locale: Locale;
  buildingId: string;
  roomType?: RoomTypeValues;
}) {
  const { m } = translator(locale);
  const router = useRouter();
  const { saving, setSaving } = useSaving();
  const [error, setError] = useState<string | null>(null);
  const p = m.property.roomTypes;
  const baht = (satang: number | null | undefined) => (satang === null || satang === undefined ? '' : String(satang / 100));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const daily = text(data.get('dailyRent'));
    setSaving(true);
    const result = await saveRoomTypeSettings({
      id: roomType?.id,
      buildingId,
      nameTh: text(data.get('nameTh')),
      nameEn: optionalText(data.get('nameEn')),
      monthlyRentSatang: toSatang(data.get('monthlyRent')),
      dailyRentSatang: daily === '' ? null : toSatang(daily),
      depositSatang: toSatang(data.get('deposit')),
      advanceMonths: toInt(data.get('advanceMonths')),
    });
    setSaving(false);
    setError(report(m, result));
    if (result.ok) {
      router.refresh();
      if (!roomType) event.currentTarget.reset();
    }
  };

  return (
    <form onSubmit={submit} lang={locale} className="grid gap-4 md:grid-cols-2">
      <Field label={p.nameTh} locale={locale} required>
        <Input name="nameTh" defaultValue={roomType?.nameTh ?? ''} required />
      </Field>
      <Field label={p.nameEn} locale={locale}>
        <Input name="nameEn" defaultValue={roomType?.nameEn ?? ''} />
      </Field>
      <Field label={p.monthlyRent} locale={locale} required>
        <Input name="monthlyRent" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={baht(roomType?.monthlyRentSatang)} required />
      </Field>
      <Field label={p.dailyRent} locale={locale}>
        <Input name="dailyRent" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={baht(roomType?.dailyRentSatang)} />
      </Field>
      <Field label={p.deposit} locale={locale} required>
        <Input name="deposit" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={baht(roomType?.depositSatang)} required />
      </Field>
      <Field label={p.advanceMonths} locale={locale} required>
        <Input name="advanceMonths" type="number" inputMode="numeric" min={0} max={12} defaultValue={roomType?.advanceMonths ?? 1} required />
      </Field>
      {error ? (
        <p role="alert" className={`${ts('body', locale)} text-danger md:col-span-2`}>
          {error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" variant="primary" locale={locale} loading={saving}>
          {p.save}
        </Button>
      </div>
    </form>
  );
}

/** A new rate plan. Existing plans are never edited (01 §3.1 A). */
export function RatePlanForm({ locale, buildingId }: { locale: Locale; buildingId: string }) {
  const { m } = translator(locale);
  const router = useRouter();
  const { saving, setSaving } = useSaving();
  const [error, setError] = useState<string | null>(null);
  const [waterMode, setWaterMode] = useState<'per_unit' | 'per_person'>('per_unit');
  const [lateKind, setLateKind] = useState<'per_day' | 'once'>('per_day');
  const p = m.property.rates;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    const result = await addRatePlanSettings({
      buildingId,
      validFrom: text(data.get('validFrom')),
      elecRateSatang: toInt(data.get('elecRate')),
      elecMinSatang: toInt(data.get('elecMin')),
      waterMode,
      waterRateSatang: toInt(data.get('waterRate')),
      waterMinSatang: toInt(data.get('waterMin')),
      waterPerPersonSatang: toInt(data.get('waterPerPerson')),
      commonFeeSatang: toInt(data.get('commonFee')),
      lateFeeRule: {
        kind: lateKind,
        amountSatang: toInt(data.get('lateFeeAmount')),
        capSatang: toInt(data.get('lateFeeCap')),
      },
    });
    setSaving(false);
    setError(report(m, result));
    if (result.ok) {
      router.refresh();
      event.currentTarget.reset();
    }
  };

  return (
    <form onSubmit={submit} lang={locale} className="grid gap-4 md:grid-cols-2">
      <Field label={p.validFrom} locale={locale} required>
        <Input name="validFrom" type="date" required />
      </Field>
      <Field label={p.electricityRate} locale={locale} required>
        <Input name="elecRate" type="number" inputMode="numeric" min={0} required />
      </Field>
      <Field label={p.electricityMin} locale={locale} required>
        <Input name="elecMin" type="number" inputMode="numeric" min={0} required />
      </Field>
      <Field label={p.waterMode} locale={locale}>
        <Select
          locale={locale}
          value={waterMode}
          onValueChange={(value) => setWaterMode(value === 'per_person' ? 'per_person' : 'per_unit')}
          options={[
            { value: 'per_unit', label: p.waterPerUnit },
            { value: 'per_person', label: p.waterPerPerson },
          ]}
        />
      </Field>
      {waterMode === 'per_unit' ? (
        <>
          <Field label={p.waterRate} locale={locale} required>
            <Input name="waterRate" type="number" inputMode="numeric" min={0} required />
          </Field>
          <Field label={p.waterMin} locale={locale} required>
            <Input name="waterMin" type="number" inputMode="numeric" min={0} required />
          </Field>
        </>
      ) : (
        <Field label={p.waterPerPersonRate} locale={locale} required>
          <Input name="waterPerPerson" type="number" inputMode="numeric" min={0} required />
        </Field>
      )}
      <Field label={p.commonFee} locale={locale}>
        <Input name="commonFee" type="number" inputMode="numeric" min={0} defaultValue={0} />
      </Field>
      <Field label={p.lateFeeMode} locale={locale}>
        <Select
          locale={locale}
          value={lateKind}
          onValueChange={(value) => setLateKind(value === 'once' ? 'once' : 'per_day')}
          options={[
            { value: 'per_day', label: p.lateFeePerDay },
            { value: 'once', label: p.lateFeeOnce },
          ]}
        />
      </Field>
      <Field label={p.lateFeeAmount} locale={locale} required>
        <Input name="lateFeeAmount" type="number" inputMode="numeric" min={0} required />
      </Field>
      <Field label={p.lateFeeCap} locale={locale} required>
        <Input name="lateFeeCap" type="number" inputMode="numeric" min={0} required />
      </Field>
      {error ? (
        <p role="alert" className={`${ts('body', locale)} text-danger md:col-span-2`}>
          {error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" variant="primary" locale={locale} loading={saving}>
          {p.save}
        </Button>
      </div>
    </form>
  );
}

export type RoomValues = {
  id: string;
  number: string;
  floor: number;
  roomTypeId: string;
  sizeSqm: number | null;
  elecMeterDigits: number;
  waterMeterDigits: number;
  sort: number;
  maintenance: boolean;
};

/** Room details and the hand-set maintenance flag (01 §4). Status otherwise comes from contracts. */
export function RoomForm({
  locale,
  buildingId,
  room,
  roomTypes,
}: {
  locale: Locale;
  buildingId: string;
  room: RoomValues;
  roomTypes: { id: string; name: string }[];
}) {
  const { m } = translator(locale);
  const router = useRouter();
  const { saving, setSaving } = useSaving();
  const [error, setError] = useState<string | null>(null);
  const [roomTypeId, setRoomTypeId] = useState(room.roomTypeId);
  const p = m.property.room;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const size = text(data.get('sizeSqm'));
    setSaving(true);
    const result = await saveRoomSettings({
      id: room.id,
      buildingId,
      number: text(data.get('number')),
      floor: toInt(data.get('floor')),
      roomTypeId,
      sizeSqm: size === '' ? null : Number(size),
      elecMeterDigits: toInt(data.get('elecMeterDigits')),
      waterMeterDigits: toInt(data.get('waterMeterDigits')),
      sort: toInt(data.get('sort')),
    });
    setSaving(false);
    setError(report(m, result));
    if (result.ok) router.refresh();
  };

  return (
    <form onSubmit={submit} lang={locale} className="grid gap-4 md:grid-cols-2">
      <Field label={p.number} locale={locale} required>
        <Input name="number" defaultValue={room.number} required />
      </Field>
      <Field label={p.floor} locale={locale} required>
        <Input name="floor" type="number" inputMode="numeric" min={0} max={60} defaultValue={room.floor} required />
      </Field>
      <Field label={p.roomType} locale={locale} required>
        <Select
          locale={locale}
          value={roomTypeId}
          onValueChange={setRoomTypeId}
          options={roomTypes.map((t) => ({ value: t.id, label: t.name }))}
        />
      </Field>
      <Field label={p.size} locale={locale}>
        <Input name="sizeSqm" type="number" inputMode="decimal" min={0} step="0.1" defaultValue={room.sizeSqm ?? ''} />
      </Field>
      <Field label={p.elecDigits} locale={locale} required>
        <Input name="elecMeterDigits" type="number" inputMode="numeric" min={3} max={8} defaultValue={room.elecMeterDigits} required />
      </Field>
      <Field label={p.waterDigits} locale={locale} required>
        <Input name="waterMeterDigits" type="number" inputMode="numeric" min={3} max={8} defaultValue={room.waterMeterDigits} required />
      </Field>
      <Field label={p.sort} locale={locale}>
        <Input name="sort" type="number" inputMode="numeric" min={0} defaultValue={room.sort} />
      </Field>
      {error ? (
        <p role="alert" className={`${ts('body', locale)} text-danger md:col-span-2`}>
          {error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" variant="primary" locale={locale} loading={saving}>
          {p.save}
        </Button>
      </div>
    </form>
  );
}

/** Sets or clears the hand-set maintenance flag for one room. */
export function MaintenanceToggle({ locale, roomId, maintenance }: { locale: Locale; roomId: string; maintenance: boolean }) {
  const { m } = translator(locale);
  const router = useRouter();
  const { saving, setSaving } = useSaving();
  const p = m.property.room;

  const toggle = async () => {
    setSaving(true);
    const result = await setRoomMaintenanceFlag({ roomId, maintenance: !maintenance });
    setSaving(false);
    report(m, result);
    if (result.ok) router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" locale={locale} loading={saving} onClick={toggle} aria-pressed={maintenance}>
        {p.maintenance}
      </Button>
      <p className={`${ts('body-sm', locale)} text-ink-muted`}>{p.maintenanceHint}</p>
    </div>
  );
}
