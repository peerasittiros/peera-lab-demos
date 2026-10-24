'use client';

import type { Locale } from '@peera/i18n';
import { Button, Field, Input, Select, Textarea, toast } from '@peera/ui';
import { useState, type FormEvent } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import { actPostAnnouncement } from '@/src/client-store/commands/property';
import type { StoreState } from '@/src/client-store/store';
import { translator } from '@/src/i18n';
import { ReadyGate } from './ReadyGate';

const viewOf = (s: StoreState) => ({
  buildings: s.data.building,
  posted: [...s.data.announcement].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  ),
});

/** Announcements (SPEC §4 O16): post a notice for a building; it shows on every tenant home at once. */
export function AnnouncementsLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <AnnouncementsBody locale={locale} />
    </ReadyGate>
  );
}

function AnnouncementsBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.tenant.owner.announce;
  const { buildings, posted } = useStore(viewOf);
  const role = useRole();
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [titleTh, setTitleTh] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyTh, setBodyTh] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];
  const buildingName = (b: (typeof buildings)[number]) =>
    locale === 'th' ? b.nameTh : (b.nameEn ?? b.nameTh);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!building) return;
    const result = actPostAnnouncement(
      { store: getStore(), role, now: () => new Date() },
      {
        buildingId: building.id,
        titleTh,
        titleEn,
        bodyTh,
        bodyEn,
      },
    );
    if (!result.ok) return toast({ title: m.ownerRepairs.errors.saveFailed });
    setTitleTh('');
    setTitleEn('');
    setBodyTh('');
    setBodyEn('');
    toast({ title: p.posted });
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form
        onSubmit={submit}
        lang={locale}
        className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-4 md:p-5"
      >
        <p className="text-ink-muted">{p.intro}</p>
        <Field label={m.property.rooms.building} locale={locale}>
          <Select
            locale={locale}
            value={building?.id ?? ''}
            onValueChange={setBuildingId}
            options={buildings.map((b) => ({
              value: b.id,
              label: buildingName(b),
            }))}
          />
        </Field>
        <Field label={p.titleTh} locale={locale} required>
          <Input
            value={titleTh}
            onChange={(e) => setTitleTh(e.target.value)}
            required
          />
        </Field>
        <Field label={p.titleEn} locale={locale} required>
          <Input
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            required
          />
        </Field>
        <Field label={p.bodyTh} locale={locale} required>
          <Textarea
            value={bodyTh}
            onChange={(e) => setBodyTh(e.target.value)}
            required
          />
        </Field>
        <Field label={p.bodyEn} locale={locale} required>
          <Textarea
            value={bodyEn}
            onChange={(e) => setBodyEn(e.target.value)}
            required
          />
        </Field>
        <p className="text-ink-muted">{m.ownerLive.postedNote}</p>
        <div>
          <Button
            type="submit"
            variant="primary"
            locale={locale}
            disabled={!building}
          >
            {p.post}
          </Button>
        </div>
      </form>
      <section className="flex flex-col gap-3">
        {posted.length === 0 ? (
          <p className="text-ink-muted">{p.none}</p>
        ) : null}
        {posted.map((a) => (
          <article
            key={a.id}
            className="flex flex-col gap-1 rounded-sm border border-line bg-surface-raised p-4"
          >
            <h2 className="text-ink">
              {locale === 'th' ? a.titleTh : a.titleEn}
            </h2>
            <p className="text-ink">{locale === 'th' ? a.bodyTh : a.bodyEn}</p>
            <span className="tabular-nums text-ink-muted">
              {a.publishedAt.slice(0, 10)}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
