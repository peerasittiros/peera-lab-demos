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
import { useState, type FormEvent } from 'react';
import { actUpdateBuilding } from '@/src/client-store/commands/property';
import { actSaveSetting } from '@/src/client-store/commands/settings';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import type { Row } from '@/src/client-store/schema';
import { SETTING } from '@/src/client-store/setting-keys';
import { commandContext, messageFor } from '@/src/components/live/OwnerEdits';
import { ReadyGate } from '@/src/components/live/ReadyGate';
import { PageHeader } from '@/src/components/PageHeader';
import { translator } from '@/src/i18n';
import { buildingsView, settingsValuesView } from './selectors';

/**
 * Billing (ux-v2/rentroll.md › Settings): the day bills are made and the day they are due, and the note printed at the
 * foot of every invoice. The note is kept in this browser, one per language.
 */
export function BillingSettings({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <Body locale={locale} />
    </ReadyGate>
  );
}

function Body({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const s = m.settings;
  const buildings = useStore(buildingsView);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];

  return (
    <>
      <PageHeader
        locale={locale}
        title={s.pages.billing.title}
        description={s.pages.billing.body}
      />
      <div className="flex max-w-[40rem] flex-col gap-8">
        <NoteForm locale={locale} />
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
            <DaysForm key={building.id} locale={locale} building={building} />
          ) : null}
        </section>
      </div>
    </>
  );
}

/** The invoice note in both languages; blank clears it, so the invoice ends after the payment details. */
function NoteForm({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const s = m.settings;
  const role = useRole();
  const values = useStore(settingsValuesView);
  const [noteTh, setNoteTh] = useState(values.noteTh ?? '');
  const [noteEn, setNoteEn] = useState(values.noteEn ?? '');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ctx = commandContext(role);
    const results = [
      await actSaveSetting(ctx, {
        key: SETTING.noteTh,
        value: noteTh.trim() === '' ? null : noteTh,
      }),
      await actSaveSetting(ctx, {
        key: SETTING.noteEn,
        value: noteEn.trim() === '' ? null : noteEn,
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
      <Field locale={locale} label={s.noteTh} hint={s.noteHint}>
        <Textarea
          lang="th"
          rows={2}
          maxLength={300}
          value={noteTh}
          onChange={(event) => setNoteTh(event.target.value)}
        />
      </Field>
      <Field locale={locale} label={s.noteEn}>
        <Textarea
          lang="en"
          rows={2}
          maxLength={300}
          value={noteEn}
          onChange={(event) => setNoteEn(event.target.value)}
        />
      </Field>
      <div>
        <Button locale={locale} type="submit" variant="primary">
          {s.saveBilling}
        </Button>
      </div>
    </form>
  );
}

/** The bill and due days of one building, as the invoice run reads them. */
function DaysForm({
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
  const [billingDay, setBillingDay] = useState(String(building.billingDay));
  const [dueDay, setDueDay] = useState(String(building.dueDay));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await actUpdateBuilding(commandContext(role), {
      buildingId: building.id,
      nameTh: building.nameTh,
      nameEn: building.nameEn,
      promptpayId: building.promptpayId,
      billingDay: Number(billingDay),
      dueDay: Number(dueDay),
    });
    toast({ title: result.ok ? s.saved : messageFor(m, result.error) });
  };

  return (
    <form
      onSubmit={submit}
      lang={locale}
      className="flex flex-col gap-4 rounded-md border border-line bg-surface-raised p-4"
    >
      <div className="flex flex-wrap gap-4">
        <Field locale={locale} label={p.billingDay} required className="w-40">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={28}
            value={billingDay}
            required
            onChange={(event) => setBillingDay(event.target.value)}
          />
        </Field>
        <Field locale={locale} label={p.dueDay} required className="w-40">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={28}
            value={dueDay}
            required
            onChange={(event) => setDueDay(event.target.value)}
          />
        </Field>
      </div>
      <div>
        <Button locale={locale} type="submit" variant="secondary">
          {s.saveBilling}
        </Button>
      </div>
    </form>
  );
}
