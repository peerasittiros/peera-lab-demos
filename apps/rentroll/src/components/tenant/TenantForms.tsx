'use client';

import { useLiveEvents } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import { Button, cn, Field, focusRing, Switch, Textarea, toast, ts } from '@peera/ui';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createRepairNow, postAnnouncementNow } from '../../actions/tenant';
import { PREFERRED_TIMES, REPAIR_CATEGORIES } from '../../domain/repair';
import { translator, type Messages } from '../../i18n';

/**
 * Refreshes the page when a tenant or owner event arrives on this sandbox (the DemoSplit's live side). The kit polls
 * `/api/events` and hands each new event over; the refresh redraws both sides from the database.
 */
export function LiveRefresh({ locale }: { locale: Locale }) {
  const router = useRouter();
  useLiveEvents({
    url: `/${locale}/api/events`,
    kinds: ['slip.submitted', 'payment.approved', 'repair.created', 'repair.updated', 'announcement.posted'],
    onEvent: () => router.refresh(),
    pollMs: 2000,
  });
  return null;
}

function failureText(m: Messages, messageKey: string): string {
  const key = messageKey.split('.').pop() as keyof Messages['tenant']['errors'];
  return m.tenant.errors[key] ?? m.tenant.errors.saveFailed;
}

/** Category grid, preferred time chips, allow-entry switch, description and a photo placeholder (01 §8 screen 8). */
export function RepairForm({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const router = useRouter();
  const p = m.tenant.repairNew;
  const [category, setCategory] = useState<(typeof REPAIR_CATEGORIES)[number]>('electrical');
  const [time, setTime] = useState<(typeof PREFERRED_TIMES)[number]>('anytime');
  const [allowEntry, setAllowEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    const result = await createRepairNow({
      category,
      description: String(data.get('description') ?? '').trim(),
      preferredTime: time,
      allowEntry,
    });
    setSaving(false);
    if (!result.ok) {
      setError(failureText(m, result.error.messageKey));
      return;
    }
    setError(null);
    setSent(true);
    toast({ title: p.sent });
    router.refresh();
  };

  if (sent) return <p className={cn(ts('body', locale), 'text-ink')}>{p.sent}</p>;
  return (
    <form onSubmit={submit} lang={locale} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-ink">{p.category}</legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {REPAIR_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                'min-h-[44px] rounded-sm border px-3 py-2 text-ink',
                category === c ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
                focusRing,
              )}
            >
              {m.tenant.repairs.category[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label={p.description} locale={locale} required>
        <Textarea name="description" required maxLength={500} />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-ink">{p.time}</legend>
        <div className="flex flex-wrap gap-2">
          {PREFERRED_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={time === t}
              onClick={() => setTime(t)}
              className={cn(
                'min-h-[44px] rounded-sm border px-4 py-2 text-ink',
                time === t ? 'border-ink bg-surface-sunken' : 'border-line bg-surface-raised',
                focusRing,
              )}
            >
              {p.times[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <Switch locale={locale} label={p.allowEntry} checked={allowEntry} onCheckedChange={setAllowEntry} />

      <div>
        <button
          type="button"
          disabled
          className={cn('min-h-[44px] rounded-sm border border-line px-4 text-ink-muted', focusRing)}
        >
          {p.photo}
        </button>{' '}
        <span className="text-ink-muted">{p.photoSoon}</span>
      </div>

      {error ? (
        <p role="alert" className={cn(ts('body', locale), 'text-danger')}>
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

/** The owner's announcement form: a title and message in both languages (01 §3.1 D.16). */
export function AnnouncementForm({ locale, buildingId }: { locale: Locale; buildingId: string }) {
  const { m } = translator(locale);
  const router = useRouter();
  const p = m.tenant.owner.announce;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    const result = await postAnnouncementNow({
      buildingId,
      titleTh: String(data.get('titleTh') ?? '').trim(),
      titleEn: String(data.get('titleEn') ?? '').trim(),
      bodyTh: String(data.get('bodyTh') ?? '').trim(),
      bodyEn: String(data.get('bodyEn') ?? '').trim(),
    });
    setSaving(false);
    if (!result.ok) {
      setError(failureText(m, result.error.messageKey));
      return;
    }
    setError(null);
    event.currentTarget.reset();
    toast({ title: p.posted });
    router.refresh();
  };

  return (
    <form onSubmit={submit} lang={locale} className="grid gap-4 md:grid-cols-2">
      <Field label={p.titleTh} locale={locale} required>
        <input name="titleTh" required className="min-h-[44px] w-full rounded-sm border border-line-strong bg-surface px-3 text-ink" />
      </Field>
      <Field label={p.titleEn} locale={locale} required>
        <input name="titleEn" required className="min-h-[44px] w-full rounded-sm border border-line-strong bg-surface px-3 text-ink" />
      </Field>
      <Field label={p.bodyTh} locale={locale} required>
        <Textarea name="bodyTh" required maxLength={1000} />
      </Field>
      <Field label={p.bodyEn} locale={locale} required>
        <Textarea name="bodyEn" required maxLength={1000} />
      </Field>
      {error ? (
        <p role="alert" className={cn(ts('body', locale), 'text-danger md:col-span-2')}>
          {error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" variant="primary" locale={locale} loading={saving}>
          {p.post}
        </Button>
      </div>
    </form>
  );
}
