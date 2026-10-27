'use client';

import type { Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Field,
  focusRing,
  Input,
  Skeleton,
  toast,
  ts,
} from '@peera/ui';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStoreInstance, useStoreState } from '../../client-store/hooks';
import {
  moveRecord,
  removeMasterRecord,
  saveCategory,
  saveUnit,
} from '../../client-store/master-commands';
import { categoryViews, unitViews } from '../../client-store/views';
import { nameIn, translator } from '../../i18n';
import { AppLink } from '../AppLink';
import { PageHeader } from '../PageHeader';

type Kind = 'category' | 'unit';

type Entry = {
  id: string;
  nameTh: string;
  nameEn: string | null;
  symbol?: string;
  /** Items that use it: a used entry cannot be removed. */
  uses: number;
};

/** Categories: names and order (filters, forms and lists follow it). */
export function CategoriesSettings({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const { ledger, status } = useStoreState();
  const page = m.settings.pages.categories;
  const items = ledger ? Object.values(ledger.entities.item) : [];
  return (
    <>
      <PageHeader locale={locale} title={page.title} description={page.body} />
      {!ledger || status === 'loading' ? (
        <Skeleton locale={locale} lines={6} />
      ) : (
        <OrderedList
          locale={locale}
          kind="category"
          entries={categoryViews(ledger).map((entry) => ({
            ...entry,
            uses: items.filter((row) => row.categoryId === entry.id).length,
          }))}
        />
      )}
    </>
  );
}

/** Units: names, short forms and order. */
export function UnitsSettings({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const { ledger, status } = useStoreState();
  const page = m.settings.pages.units;
  const items = ledger ? Object.values(ledger.entities.item) : [];
  return (
    <>
      <PageHeader locale={locale} title={page.title} description={page.body} />
      {!ledger || status === 'loading' ? (
        <Skeleton locale={locale} lines={6} />
      ) : (
        <OrderedList
          locale={locale}
          kind="unit"
          entries={unitViews(ledger).map((entry) => ({
            ...entry,
            uses: items.filter(
              (row) =>
                row.baseUnitId === entry.id ||
                (row.packs as { unitId: string }[]).some(
                  (pack) => pack.unitId === entry.id,
                ),
            ).length,
          }))}
        />
      )}
    </>
  );
}

const iconButton = cn(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-40',
  focusRing,
);

/**
 * A list you can rename, reorder and trim. Order moves one place at a time with the arrow buttons (touch, mouse and
 * keyboard alike); the new position is announced, and focus stays on the arrow so it can be pressed again.
 */
function OrderedList({
  locale,
  kind,
  entries,
}: {
  locale: Locale;
  kind: Kind;
  entries: Entry[];
}) {
  const { t, tp, m } = translator(locale);
  const s = m.settings;
  const store = useStoreInstance();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // The arrow to focus once the list has re-rendered in its new order.
  const refocus = useRef<string | null>(null);

  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    const target = document.getElementById(id) as HTMLButtonElement | null;
    // At the end of the list the arrow is disabled: fall back to the other one.
    const other = id.startsWith('up-')
      ? id.replace('up-', 'down-')
      : id.replace('down-', 'up-');
    (target && !target.disabled
      ? target
      : (document.getElementById(other) as HTMLElement | null)
    )?.focus();
  }, [entries]);

  const errorOf = (
    result: { ok: boolean; error?: { messageKey: string } } | null,
  ) =>
    t(
      (result?.error?.messageKey ?? 'errors.unexpected') as 'errors.unexpected',
    );

  const move = async (entry: Entry, direction: 'up' | 'down') => {
    if (!store) return;
    setBusy(`${direction}-${entry.id}`);
    const result = await moveRecord(store, kind, entry.id, direction, 'owner');
    setBusy(null);
    if (!result.ok) {
      toast({ title: errorOf(result) });
      return;
    }
    setAnnouncement(
      t('settings.moved', {
        name: nameIn(entry, locale),
        position: result.data.position + 1,
      }),
    );
    refocus.current = `${direction}-${entry.id}`;
  };

  const remove = async (entry: Entry) => {
    if (!store) return;
    setBusy(`remove-${entry.id}`);
    const result = await removeMasterRecord(store, kind, entry.id, 'owner');
    setBusy(null);
    toast({ title: result.ok ? s.removed : errorOf(result) });
  };

  return (
    <div className="flex max-w-[48rem] flex-col gap-5">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ol className="m-0 flex list-none flex-col divide-y divide-line rounded-md border border-line bg-surface-raised p-0">
        {entries.map((entry, index) =>
          editing === entry.id ? (
            <li key={entry.id} className="px-3 py-3">
              <EntryForm
                locale={locale}
                kind={kind}
                entry={entry}
                onDone={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-2 py-1 pr-1 pl-3"
            >
              <span
                className={cn(
                  ts('ui', locale),
                  'num w-6 shrink-0 text-ink-muted',
                )}
              >
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col py-2">
                <span className={cn(ts('ui', locale), 'text-ink')}>
                  {nameIn(entry, locale)}
                  {entry.symbol ? (
                    <span className="code text-ink-muted">{` · ${entry.symbol}`}</span>
                  ) : null}
                </span>
                <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                  {kind === 'category' && entry.uses > 0
                    ? `${tp('settings.inUse', entry.uses)} · `
                    : tp('settings.inUse', entry.uses)}
                  {kind === 'category' && entry.uses > 0 ? (
                    <>
                      <AppLink
                        href={`/${locale}/items?category=${entry.id}`}
                        className={cn(
                          // Always underlined: inside a line of text a link must not rely on colour alone (axe link-in-text-block).
                          'text-primary underline underline-offset-4',
                          focusRing,
                        )}
                      >
                        {s.viewItems}
                      </AppLink>
                    </>
                  ) : null}
                </span>
              </span>
              <span className="flex shrink-0 items-center">
                <button
                  id={`up-${entry.id}`}
                  type="button"
                  className={iconButton}
                  disabled={index === 0 || busy !== null}
                  aria-label={t('settings.moveUp', {
                    name: nameIn(entry, locale),
                  })}
                  onClick={() => void move(entry, 'up')}
                >
                  <ArrowUp aria-hidden size={18} strokeWidth={1.75} />
                </button>
                <button
                  id={`down-${entry.id}`}
                  type="button"
                  className={iconButton}
                  disabled={index === entries.length - 1 || busy !== null}
                  aria-label={t('settings.moveDown', {
                    name: nameIn(entry, locale),
                  })}
                  onClick={() => void move(entry, 'down')}
                >
                  <ArrowDown aria-hidden size={18} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={t('settings.editName', {
                    name: nameIn(entry, locale),
                  })}
                  onClick={() => setEditing(entry.id)}
                >
                  <Pencil aria-hidden size={18} strokeWidth={1.75} />
                </button>
                {entry.uses === 0 ? (
                  <button
                    type="button"
                    className={iconButton}
                    disabled={busy !== null}
                    aria-label={`${m.common.remove} ${nameIn(entry, locale)}`}
                    onClick={() => void remove(entry)}
                  >
                    <Trash2 aria-hidden size={18} strokeWidth={1.75} />
                  </button>
                ) : null}
              </span>
            </li>
          ),
        )}
      </ol>
      <EntryForm locale={locale} kind={kind} />
    </div>
  );
}

/** Adds an entry (no `entry`) or edits one in place. */
function EntryForm({
  locale,
  kind,
  entry,
  onDone,
}: {
  locale: Locale;
  kind: Kind;
  entry?: Entry;
  onDone?: () => void;
}) {
  const { t, m } = translator(locale);
  const s = m.settings;
  const store = useStoreInstance();
  const [draft, setDraft] = useState({
    nameTh: entry?.nameTh ?? '',
    nameEn: entry?.nameEn ?? '',
    symbol: entry?.symbol ?? '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!store) return;
    if (!draft.nameTh.trim() || (kind === 'unit' && !draft.symbol.trim())) {
      toast({ title: m.errors.nameRequired });
      return;
    }
    setSaving(true);
    const names = { id: entry?.id, nameTh: draft.nameTh, nameEn: draft.nameEn };
    const result =
      kind === 'category'
        ? await saveCategory(store, names, 'owner')
        : await saveUnit(store, { ...names, symbol: draft.symbol }, 'owner');
    setSaving(false);
    if (!result.ok) {
      toast({
        title: t(
          (result.error.messageKey ??
            'errors.unexpected') as 'errors.unexpected',
        ),
      });
      return;
    }
    toast({
      title: entry
        ? s.updated
        : kind === 'category'
          ? s.categoryAdded
          : s.unitAdded,
    });
    if (entry) onDone?.();
    else setDraft({ nameTh: '', nameEn: '', symbol: '' });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <Field locale={locale} label={s.nameTh} className="min-w-[9rem] flex-1">
        <Input
          lang="th"
          value={draft.nameTh}
          maxLength={60}
          autoFocus={Boolean(entry)}
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
      {entry ? (
        <span className="flex gap-2">
          <Button
            locale={locale}
            type="submit"
            variant="primary"
            loading={saving}
          >
            {m.common.save}
          </Button>
          <Button locale={locale} variant="ghost" onClick={onDone}>
            {m.common.cancel}
          </Button>
        </span>
      ) : (
        <Button
          locale={locale}
          type="submit"
          variant="secondary"
          loading={saving}
        >
          <Plus aria-hidden size={16} strokeWidth={1.75} />
          {kind === 'category' ? s.addCategory : s.addUnit}
        </Button>
      )}
    </form>
  );
}
