'use client';

import type { Locale } from '@peera/i18n';
import { Button, Field, Input, Select, toast } from '@peera/ui';
import { useState, type FormEvent } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useRole } from '@/src/client-store/role';
import { actIssueCreditNote } from '@/src/client-store/commands/billing';
import {
  actAddRatePlan,
  actUpdateBuilding,
} from '@/src/client-store/commands/property';
import type { Row, Role } from '@/src/client-store/schema';
import { translator, type Messages } from '@/src/i18n';

/** Baht typed in a form, as satang. Anything that isn't a number becomes 0; the command decides what is allowed. */
const toSatang = (baht: string) => Math.round((Number(baht) || 0) * 100);
const toBaht = (satang: number) => (satang / 100).toFixed(2);

/** The text for a command's error key, such as `property.errors.invalid`. Falls back to the key itself. */
function messageFor(m: Messages, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      m,
    );
  return typeof value === 'string' ? value : key;
}

const commandContext = (role: Role) => ({
  store: getStore(),
  role,
  now: () => new Date(),
});

/** Edits one building's names, PromptPay ID and billing days (SPEC §4 O5). Opens in place; saves through the command. */
export function BuildingEditForm({
  locale,
  building,
}: {
  locale: Locale;
  building: Row<'building'>;
}) {
  const { m } = translator(locale);
  const p = m.ownerEdits;
  const role = useRole();
  const [editing, setEditing] = useState(false);
  const [nameTh, setNameTh] = useState(building.nameTh);
  const [nameEn, setNameEn] = useState(building.nameEn ?? '');
  const [promptpayId, setPromptpayId] = useState(building.promptpayId);
  const [billingDay, setBillingDay] = useState(String(building.billingDay));
  const [dueDay, setDueDay] = useState(String(building.dueDay));

  const startEdit = () => {
    setNameTh(building.nameTh);
    setNameEn(building.nameEn ?? '');
    setPromptpayId(building.promptpayId);
    setBillingDay(String(building.billingDay));
    setDueDay(String(building.dueDay));
    setEditing(true);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = actUpdateBuilding(commandContext(role), {
      buildingId: building.id,
      nameTh,
      nameEn: nameEn.trim() || null,
      promptpayId,
      billingDay: Number(billingDay),
      dueDay: Number(dueDay),
    });
    toast({
      title: result.ok ? p.saved : messageFor(m, result.error),
    });
    if (result.ok) setEditing(false);
  };

  if (!editing) {
    return (
      <Button
        type="button"
        variant="secondary"
        locale={locale}
        onClick={startEdit}
      >
        {p.edit}
      </Button>
    );
  }
  return (
    <form
      onSubmit={submit}
      lang={locale}
      className="flex flex-col gap-4 rounded-sm border border-line bg-surface-sunken p-4"
    >
      <Field label={p.nameTh} locale={locale} required>
        <Input
          value={nameTh}
          onChange={(e) => setNameTh(e.target.value)}
          required
        />
      </Field>
      <Field label={p.nameEn} locale={locale}>
        <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      </Field>
      <Field label={p.promptpayId} locale={locale} required>
        <Input
          value={promptpayId}
          onChange={(e) => setPromptpayId(e.target.value)}
          required
        />
      </Field>
      <Field label={p.billingDay} locale={locale} required>
        <Input
          type="number"
          min={1}
          max={28}
          value={billingDay}
          onChange={(e) => setBillingDay(e.target.value)}
          required
        />
      </Field>
      <Field label={p.dueDay} locale={locale} required>
        <Input
          type="number"
          min={1}
          max={28}
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
          required
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" locale={locale}>
          {p.save}
        </Button>
        <Button
          type="button"
          variant="ghost"
          locale={locale}
          onClick={() => setEditing(false)}
        >
          {p.cancel}
        </Button>
      </div>
    </form>
  );
}

const waterModeOf = (value: string) =>
  value === 'per_person' ? 'per_person' : 'per_unit';

/**
 * Adds a rate plan from a date (SPEC §4 O5). The fields start from the plan in force today, so the owner changes only
 * what changed. Bills generated before the date keep their rate.
 */
export function RatePlanForm({
  locale,
  buildingId,
  today,
  current,
}: {
  locale: Locale;
  buildingId: string;
  today: string;
  current: Row<'rate_plan'> | null;
}) {
  const { m } = translator(locale);
  const p = m.ownerEdits;
  const role = useRole();
  const [editing, setEditing] = useState(false);
  const [validFrom, setValidFrom] = useState('');
  const [electricity, setElectricity] = useState('');
  const [electricityMin, setElectricityMin] = useState('');
  const [waterMode, setWaterMode] = useState<'per_unit' | 'per_person'>(
    'per_unit',
  );
  const [waterRate, setWaterRate] = useState('');
  const [waterMin, setWaterMin] = useState('');
  const [waterPerPerson, setWaterPerPerson] = useState('');
  const [commonFee, setCommonFee] = useState('');

  const startEdit = () => {
    setValidFrom('');
    setElectricity(toBaht(current?.elecRateSatang ?? 0));
    setElectricityMin(toBaht(current?.elecMinSatang ?? 0));
    setWaterMode(waterModeOf(current?.waterMode ?? 'per_unit'));
    setWaterRate(toBaht(current?.waterRateSatang ?? 0));
    setWaterMin(toBaht(current?.waterMinSatang ?? 0));
    setWaterPerPerson(toBaht(current?.waterPerPersonSatang ?? 0));
    setCommonFee(toBaht(current?.commonFeeSatang ?? 0));
    setEditing(true);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = actAddRatePlan(commandContext(role), {
      buildingId,
      validFrom,
      elecRateSatang: toSatang(electricity),
      elecMinSatang: toSatang(electricityMin),
      waterMode,
      waterRateSatang: toSatang(waterRate),
      waterMinSatang: toSatang(waterMin),
      waterPerPersonSatang: toSatang(waterPerPerson),
      commonFeeSatang: toSatang(commonFee),
    });
    toast({
      title: result.ok ? p.rateSaved : messageFor(m, result.error),
    });
    if (result.ok) setEditing(false);
  };

  if (!editing) {
    return (
      <Button
        type="button"
        variant="secondary"
        locale={locale}
        onClick={startEdit}
      >
        {p.addRate}
      </Button>
    );
  }
  const money = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    required = true,
  ) => (
    <Field label={label} locale={locale} required={required}>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </Field>
  );
  return (
    <form
      onSubmit={submit}
      lang={locale}
      className="flex flex-col gap-4 rounded-sm border border-line bg-surface-sunken p-4"
    >
      <Field label={p.validFrom} locale={locale} required>
        <Input
          type="date"
          min={today}
          value={validFrom}
          onChange={(e) => setValidFrom(e.target.value)}
          required
        />
      </Field>
      {money(p.electricity, electricity, setElectricity)}
      {money(p.electricityMin, electricityMin, setElectricityMin)}
      <Field label={p.waterMode} locale={locale} required>
        <Select
          locale={locale}
          value={waterMode}
          onValueChange={(next) =>
            setWaterMode(next === 'per_person' ? 'per_person' : 'per_unit')
          }
          options={[
            { value: 'per_unit', label: p.waterPerUnit },
            { value: 'per_person', label: p.waterPerPerson },
          ]}
        />
      </Field>
      {money(p.waterRate, waterRate, setWaterRate)}
      {money(p.waterMin, waterMin, setWaterMin)}
      {money(p.waterPerPersonRate, waterPerPerson, setWaterPerPerson)}
      {money(p.commonFee, commonFee, setCommonFee)}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" locale={locale}>
          {p.save}
        </Button>
        <Button
          type="button"
          variant="ghost"
          locale={locale}
          onClick={() => setEditing(false)}
        >
          {p.cancel}
        </Button>
      </div>
    </form>
  );
}

/** Issues a credit note against a sent invoice (SPEC §4 O11). The invoice itself is never changed. */
export function CreditNoteForm({
  locale,
  invoiceId,
  owedSatang,
}: {
  locale: Locale;
  invoiceId: string;
  owedSatang: number;
}) {
  const { m } = translator(locale);
  const p = m.ownerEdits;
  const role = useRole();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = actIssueCreditNote(commandContext(role), {
      invoiceId,
      amountSatang: toSatang(amount),
      reason: reason.trim(),
    });
    toast({
      title: result.ok ? p.creditIssued : messageFor(m, result.error),
    });
    if (result.ok) {
      setAmount('');
      setReason('');
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <Button
        type="button"
        variant="secondary"
        locale={locale}
        onClick={() => setEditing(true)}
      >
        {p.openCredit}
      </Button>
    );
  }
  return (
    <form
      onSubmit={submit}
      lang={locale}
      className="flex w-full flex-col gap-3 rounded-sm border border-line bg-surface-sunken p-4"
    >
      <p className="m-0 text-ink-muted">{p.creditHint}</p>
      <Field label={p.creditAmount} locale={locale} required>
        <Input
          type="number"
          min={0.01}
          max={toBaht(owedSatang)}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </Field>
      <Field label={p.creditReason} locale={locale} required>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" locale={locale}>
          {p.creditSubmit}
        </Button>
        <Button
          type="button"
          variant="ghost"
          locale={locale}
          onClick={() => setEditing(false)}
        >
          {p.cancel}
        </Button>
      </div>
    </form>
  );
}
