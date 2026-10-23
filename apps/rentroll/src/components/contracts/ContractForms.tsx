'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { Button, Field, Input, Select, toast, ts } from '@peera/ui';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { giveNoticeTenant, moveInTenant, moveOutTenant, previewMoveOutSettlement } from '../../actions/contracts';
import { CHECKLIST_KEYS, CHECKLIST_LABELS } from '../../domain/move';
import { translator, type Messages } from '../../i18n';

type Mark = 'ok' | 'damaged' | null;
type Marks = Record<(typeof CHECKLIST_KEYS)[number], Mark>;
type Failure = { ok: false; error: { messageKey: string } };

const blankMarks = (): Marks => ({ walls: null, floor: null, door_lock: null, aircon: null, furniture: null, appliances: null });

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

function marksToList(marks: Marks) {
  return CHECKLIST_KEYS.map((key) => ({ key, status: marks[key] }));
}

function failureText(m: Messages, result: Failure): string {
  const key = result.error.messageKey.split('.').pop() as keyof Messages['contracts']['errors'];
  return m.contracts.errors[key] ?? m.contracts.errors.saveFailed;
}

/** A row of OK / damaged / not checked choices, one per checklist item. */
export function ChecklistPicker({
  locale,
  marks,
  onChange,
}: {
  locale: Locale;
  marks: Marks;
  onChange: (next: Marks) => void;
}) {
  const { m } = translator(locale);
  const label = (key: (typeof CHECKLIST_KEYS)[number]) => (locale === 'th' ? CHECKLIST_LABELS[key].th : CHECKLIST_LABELS[key].en);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CHECKLIST_KEYS.map((key) => (
        <Field key={key} label={label(key)} locale={locale}>
          <Select
            locale={locale}
            value={marks[key] ?? 'none'}
            onValueChange={(value) => onChange({ ...marks, [key]: value === 'ok' || value === 'damaged' ? value : null })}
            options={[
              { value: 'none', label: m.contracts.checklist.none },
              { value: 'ok', label: m.contracts.checklist.ok },
              { value: 'damaged', label: m.contracts.checklist.damaged },
            ]}
          />
        </Field>
      ))}
    </div>
  );
}

export type RoomChoice = {
  id: string;
  label: string;
  monthlyRentSatang: number;
  depositSatang: number;
  advanceMonths: number;
};

export function MoveInForm({
  locale,
  rooms,
  renters,
  initialRoomId,
  today,
}: {
  locale: Locale;
  rooms: RoomChoice[];
  renters: { id: string; name: string }[];
  initialRoomId: string | null;
  today: string;
}) {
  const { m } = translator(locale);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState(initialRoomId ?? rooms[0]?.id ?? '');
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [renterId, setRenterId] = useState(renters[0]?.id ?? '');
  const [rent, setRent] = useState(room ? String(room.monthlyRentSatang / 100) : '');
  const [deposit, setDeposit] = useState(room ? String(room.depositSatang / 100) : '');
  const [advance, setAdvance] = useState(String(room?.advanceMonths ?? 1));
  const [marks, setMarks] = useState<Marks>(blankMarks());
  const p = m.contracts.moveIn;

  const pickRoom = (id: string) => {
    setRoomId(id);
    const next = rooms.find((r) => r.id === id);
    if (next) {
      setRent(String(next.monthlyRentSatang / 100));
      setDeposit(String(next.depositSatang / 100));
      setAdvance(String(next.advanceMonths));
    }
  };

  if (rooms.length === 0) return <p className="text-ink-muted">{p.noVacant}</p>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const emergencyName = text(data.get('emergencyName'));
    const emergencyPhone = text(data.get('emergencyPhone'));
    setSaving(true);
    const result = await moveInTenant({
      roomId,
      renter:
        mode === 'new'
          ? {
              mode: 'new',
              name: text(data.get('renterName')),
              phone: optionalText(data.get('renterPhone')),
              emergencyContact: emergencyName && emergencyPhone ? { name: emergencyName, phone: emergencyPhone } : null,
            }
          : { mode: 'existing', renterId },
      startDate: text(data.get('startDate')),
      monthlyRentSatang: toSatang(rent),
      depositSatang: toSatang(deposit),
      advanceMonths: toInt(advance),
      occupants: toInt(data.get('occupants')),
      parkingSatang: toSatang(data.get('parking')),
      internetSatang: toSatang(data.get('internet')),
      elecReading: toInt(data.get('elecReading')),
      waterReading: toInt(data.get('waterReading')),
      checklist: marksToList(marks),
      note: null,
    });
    setSaving(false);
    if (!result.ok) {
      const message = failureText(m, result);
      setError(message);
      toast({ title: message });
      return;
    }
    toast({ title: m.contracts.moveIn.title });
    router.push(`/${locale}/owner/contracts/${result.data.contractId}`);
  };

  return (
    <form onSubmit={submit} lang={locale} className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-2">
        <Field label={p.room} locale={locale} required>
          <Select locale={locale} value={roomId} onValueChange={pickRoom} options={rooms.map((r) => ({ value: r.id, label: r.label }))} />
        </Field>
        <Field label={p.startDate} locale={locale} required>
          <Input name="startDate" type="date" defaultValue={today} required />
        </Field>
        <Field label={p.renterMode} locale={locale} required>
          <Select
            locale={locale}
            value={mode}
            onValueChange={(value) => setMode(value === 'existing' ? 'existing' : 'new')}
            options={[
              { value: 'new', label: p.newRenter },
              { value: 'existing', label: p.existingRenter },
            ]}
          />
        </Field>
        {mode === 'existing' ? (
          <Field label={p.renter} locale={locale} required>
            <Select
              locale={locale}
              value={renterId}
              onValueChange={setRenterId}
              options={renters.map((r) => ({ value: r.id, label: r.name }))}
            />
          </Field>
        ) : (
          <>
            <Field label={p.renterName} locale={locale} required>
              <Input name="renterName" required />
            </Field>
            <Field label={p.renterPhone} locale={locale}>
              <Input name="renterPhone" type="tel" inputMode="tel" />
            </Field>
            <Field label={p.emergencyName} locale={locale}>
              <Input name="emergencyName" />
            </Field>
            <Field label={p.emergencyPhone} locale={locale}>
              <Input name="emergencyPhone" type="tel" inputMode="tel" />
            </Field>
            <Field label={m.contracts.tenants.idLabel} hint={m.contracts.tenants.idNote} locale={locale}>
              <Input disabled value="" readOnly />
            </Field>
          </>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Field label={p.monthlyRent} locale={locale} required>
          <Input name="rent" type="number" inputMode="decimal" min={0} step="0.01" value={rent} onChange={(e) => setRent(e.target.value)} required />
        </Field>
        <Field label={p.deposit} locale={locale} required>
          <Input name="deposit" type="number" inputMode="decimal" min={0} step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} required />
        </Field>
        <Field label={p.advanceMonths} locale={locale} required>
          <Input name="advance" type="number" inputMode="numeric" min={0} max={12} value={advance} onChange={(e) => setAdvance(e.target.value)} required />
        </Field>
        <Field label={p.occupants} locale={locale} required>
          <Input name="occupants" type="number" inputMode="numeric" min={1} max={4} defaultValue={1} required />
        </Field>
        <Field label={p.parking} locale={locale}>
          <Input name="parking" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={0} />
        </Field>
        <Field label={p.internet} locale={locale}>
          <Input name="internet" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={0} />
        </Field>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Field label={p.elecReading} locale={locale} required>
          <Input name="elecReading" type="number" inputMode="numeric" min={0} required />
        </Field>
        <Field label={p.waterReading} locale={locale} required>
          <Input name="waterReading" type="number" inputMode="numeric" min={0} required />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={ts('title', locale)}>{p.checklist}</h2>
        <p className="text-ink-muted">{p.checklistIntro}</p>
        <ChecklistPicker locale={locale} marks={marks} onChange={setMarks} />
      </section>

      {error ? (
        <p role="alert" className={`${ts('body', locale)} text-danger`}>
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="primary" locale={locale} loading={saving}>
          {p.submit}
        </Button>
      </div>
    </form>
  );
}

/** Gives notice. The room stays occupied until the move-out is recorded. */
export function GiveNoticeButton({ locale, contractId, today }: { locale: Locale; contractId: string; today: string }) {
  const { m } = translator(locale);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const p = m.contracts.detail;
  const give = async () => {
    setSaving(true);
    const result = await giveNoticeTenant({ contractId, noticeDate: today });
    setSaving(false);
    if (!result.ok) {
      toast({ title: failureText(m, result) });
      return;
    }
    toast({ title: p.noticeDone });
    router.refresh();
  };
  return (
    <Button type="button" variant="secondary" locale={locale} loading={saving} onClick={give}>
      {p.giveNotice}
    </Button>
  );
}

type Preview = {
  units: { electricity: number; water: number };
  utilities: { electricity: number; water: number };
  deductions: { kind: 'unpaid' | 'final_utilities' | 'damages' | 'cleaning'; amount: number }[];
  refund: number;
  unpaid: number;
  deposit: number;
  moveInItems: { key: string; status: string | null }[] | null;
  moveOutItems: { key: string; status: string | null }[];
};

/** Final readings and checklist. The preview works out the settlement; confirm commits the same numbers. */
export function MoveOutForm({ locale, contractId, today }: { locale: Locale; contractId: string; today: string }) {
  const { m } = translator(locale);
  const router = useRouter();
  const [saving, setSaving] = useState<'preview' | 'confirm' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [marks, setMarks] = useState<Marks>(blankMarks());
  const p = m.contracts.moveOut;

  const readForm = (form: HTMLFormElement) => {
    const data = new FormData(form);
    return {
      contractId,
      moveOutDate: text(data.get('moveOutDate')),
      elecReading: toInt(data.get('elecReading')),
      waterReading: toInt(data.get('waterReading')),
      elecRollover: data.get('elecRollover') === 'yes',
      waterRollover: data.get('waterRollover') === 'yes',
      checklist: marksToList(marks),
      damages: toSatang(data.get('damages')),
      cleaningFee: toSatang(data.get('cleaning')),
    };
  };

  const onPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving('preview');
    setError(null);
    const result = await previewMoveOutSettlement(readForm(event.currentTarget));
    setSaving(null);
    if (!result.ok) {
      setPreview(null);
      setError(failureText(m, result));
      return;
    }
    setPreview(result.data);
  };

  const confirm = async (form: HTMLFormElement) => {
    setSaving('confirm');
    const result = await moveOutTenant(readForm(form));
    setSaving(null);
    if (!result.ok) {
      setError(failureText(m, result));
      return;
    }
    toast({ title: p.confirmed });
    router.refresh();
  };

  const label = (kind: Preview['deductions'][number]['kind']) =>
    ({ unpaid: p.unpaid, final_utilities: p.utilities, damages: p.damagesLine, cleaning: p.cleaningLine })[kind];

  return (
    <form onSubmit={onPreview} lang={locale} className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-2">
        <Field label={p.moveOutDate} locale={locale} required>
          <Input name="moveOutDate" type="date" defaultValue={today} required />
        </Field>
        <Field label={p.elecReading} locale={locale} required>
          <Input name="elecReading" type="number" inputMode="numeric" min={0} required />
        </Field>
        <Field label={p.elecRollover} locale={locale}>
          <Select name="elecRollover" locale={locale} defaultValue="no" options={[{ value: 'no', label: m.contracts.blank }, { value: 'yes', label: p.elecRollover }]} />
        </Field>
        <Field label={p.waterReading} locale={locale} required>
          <Input name="waterReading" type="number" inputMode="numeric" min={0} required />
        </Field>
        <Field label={p.waterRollover} locale={locale}>
          <Select name="waterRollover" locale={locale} defaultValue="no" options={[{ value: 'no', label: m.contracts.blank }, { value: 'yes', label: p.waterRollover }]} />
        </Field>
        <Field label={p.damages} locale={locale}>
          <Input name="damages" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={0} />
        </Field>
        <Field label={p.cleaning} locale={locale}>
          <Input name="cleaning" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={0} />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={ts('title', locale)}>{p.checklist}</h2>
        <p className="text-ink-muted">{p.checklistIntro}</p>
        <ChecklistPicker locale={locale} marks={marks} onChange={setMarks} />
      </section>

      {error ? (
        <p role="alert" className={`${ts('body', locale)} text-danger`}>
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="secondary" locale={locale} loading={saving === 'preview'}>
          {p.preview}
        </Button>
      </div>

      {preview ? (
        <section className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-4 md:p-5">
          <h2 className={ts('title', locale)}>{p.settlementTitle}</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-ink md:grid-cols-3">
            <dt className="text-ink-muted">{p.electricity}</dt>
            <dd className="tabular-nums">{formatMoney(preview.utilities.electricity, locale)}</dd>
            <dt className="text-ink-muted">{p.units}</dt>
            <dd className="tabular-nums">{preview.units.electricity}</dd>
            <dt className="text-ink-muted">{p.water}</dt>
            <dd className="tabular-nums">{formatMoney(preview.utilities.water, locale)}</dd>
            <dt className="text-ink-muted">{p.units}</dt>
            <dd className="tabular-nums">{preview.units.water}</dd>
            <dt className="text-ink-muted">{p.deposit}</dt>
            <dd>{formatMoney(preview.deposit, locale)}</dd>
          </dl>
          <ul className="flex flex-col gap-1 text-ink">
            {preview.deductions.map((d) => (
              <li key={d.kind} className="flex justify-between gap-4">
                <span>{label(d.kind)}</span>
                <span className="tabular-nums">{formatMoney(d.amount, locale)}</span>
              </li>
            ))}
          </ul>
          <p className="text-ink">
            <strong>{preview.refund < 0 ? p.owed : p.refund}</strong>{' '}
            <span className="tabular-nums">{formatMoney(Math.abs(preview.refund), locale)}</span>
          </p>
          <div>
            <Button
              type="button"
              variant="primary"
              locale={locale}
              loading={saving === 'confirm'}
              onClick={(event) => {
                const form = event.currentTarget.closest('form');
                if (form) void confirm(form as HTMLFormElement);
              }}
            >
              {p.confirm}
            </Button>
          </div>
        </section>
      ) : null}
    </form>
  );
}
