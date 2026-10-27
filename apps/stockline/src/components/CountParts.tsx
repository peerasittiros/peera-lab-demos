'use client';

import { useDemoHref } from '@peera/demo-kit';
import { formatMoney, type Locale } from '@peera/i18n';
import {
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
  Select,
  StatusBadge,
  Stepper,
  Switch,
  toast,
  ts,
  type StatusTone,
} from '@peera/ui';
import { Check, ClipboardCheck, Hourglass } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useStoreInstance } from '../client-store/hooks';
import {
  approveCount,
  saveCountLine,
  startCount,
  submitCount,
  type CountScopeInput,
} from '../client-store/count-commands';
import type { CountLineView } from '../client-store/views';
import type { Named } from '../domain/read-models';
import type { CountStatus } from '../domain/read-models';
import type { Role } from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { useMedia } from '../lib/use-media';
import { formatQty, formatSigned } from '../lib/format';
import { ChipGroup } from './ChipGroup';

const statusStyle: Record<
  CountStatus,
  { tone: StatusTone; icon: typeof Check }
> = {
  open: { tone: 'info', icon: ClipboardCheck },
  submitted: { tone: 'warning', icon: Hourglass },
  approved: { tone: 'success', icon: Check },
};

export function CountStatusBadge({
  status,
  locale,
}: {
  status: CountStatus;
  locale: Locale;
}) {
  const { m } = translator(locale);
  return (
    <StatusBadge
      tone={statusStyle[status].tone}
      icon={statusStyle[status].icon}
      label={m.countStatus[status]}
      locale={locale}
    />
  );
}

export function StartCountButton({
  locale,
  role,
  categories,
}: {
  locale: Locale;
  role: Role;
  categories: Named[];
}) {
  const store = useStoreInstance();
  const { t, m } = translator(locale);
  const router = useRouter();
  const href = useDemoHref();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'all' | 'category'>('all');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [blind, setBlind] = useState(true);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    const scope: CountScopeInput =
      kind === 'all' ? { kind: 'all' } : { kind: 'category', categoryId };
    const result = store
      ? await startCount(store, { scope, blind }, role)
      : null;
    setBusy(false);
    if (!result?.ok) {
      toast({
        title: t(
          (result?.error.messageKey ??
            'errors.unexpected') as 'errors.unexpected',
        ),
      });
      return;
    }
    setOpen(false);
    router.push(href(`/${locale}/counts/${result.data.id}`));
  };

  return (
    <>
      <Button locale={locale} variant="primary" onClick={() => setOpen(true)}>
        {m.counts.start}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent locale={locale}>
          <DialogTitle locale={locale}>{m.counts.startTitle}</DialogTitle>
          <DialogDescription locale={locale}>
            {m.counts.subtitle}
          </DialogDescription>
          <div className="mt-5 flex flex-col gap-5">
            <ChipGroup
              locale={locale}
              legend={m.counts.scope}
              value={kind}
              onChange={(value) => setKind(value as 'all' | 'category')}
              chips={[
                { value: 'all', label: m.counts.scopeAll },
                { value: 'category', label: m.counts.scopeCategory },
              ]}
            />
            {kind === 'category' ? (
              <Field locale={locale} label={m.items.form.category}>
                <Select
                  locale={locale}
                  value={categoryId}
                  onValueChange={setCategoryId}
                  options={categories.map((entry) => ({
                    value: entry.id,
                    label: nameIn(entry, locale),
                  }))}
                />
              </Field>
            ) : null}
            <div>
              <Switch
                locale={locale}
                label={m.counts.blind}
                checked={blind}
                onCheckedChange={setBlind}
              />
              <p
                className={cn(ts('body-sm', locale), 'm-0 mt-1 text-ink-muted')}
              >
                {m.counts.blindHint}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button locale={locale} variant="ghost">
                {m.common.cancel}
              </Button>
            </DialogClose>
            <Button
              locale={locale}
              variant="primary"
              loading={busy}
              onClick={() => void start()}
            >
              {m.counts.begin}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Counting and approval (02 §8 screen 5). */
export function CountSheet({
  locale,
  role,
  sessionId,
  status,
  lines,
}: {
  locale: Locale;
  role: Role;
  sessionId: string;
  status: CountStatus;
  lines: CountLineView[];
}) {
  const store = useStoreInstance();
  const { t, m } = translator(locale);
  const [drafts, setDrafts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      lines.map((line) => [line.itemId, line.counted ?? line.expected ?? 0]),
    ),
  );
  const [query, setQuery] = useState('');
  const [onlyDifferences, setOnlyDifferences] = useState(
    status === 'submitted',
  );
  const [busy, setBusy] = useState<string | null>(null);
  const editable = status === 'open';
  const firstOpen = lines.findIndex((line) => line.counted === null);
  const [cursor, setCursor] = useState(firstOpen < 0 ? 0 : firstOpen);
  const [showAll, setShowAll] = useState(false);
  const phone = !useMedia('(min-width: 768px)');
  const done = lines.filter((line) => line.counted !== null).length;
  const progress =
    lines.length === 0 ? 0 : Math.round((done / lines.length) * 100);
  const differences = lines.filter(
    (line) =>
      line.counted !== null &&
      line.expected !== null &&
      line.counted !== line.expected,
  );
  const shrinkage = differences.reduce(
    (sum, line) =>
      sum +
      Math.max(0, (line.expected ?? 0) - (line.counted ?? 0)) *
        (line.item.costSatang ?? 0),
    0,
  );

  const save = async (itemId: string) => {
    setBusy(itemId);
    const counted = Math.max(0, Math.round(drafts[itemId] ?? 0));
    const result = store
      ? await saveCountLine(store, sessionId, itemId, counted, role)
      : null;
    setBusy(null);
    if (!result?.ok) {
      toast({
        title: t(
          (result?.error.messageKey ??
            'errors.unexpected') as 'errors.unexpected',
        ),
      });
      return false;
    }
    return true;
  };

  // Phones: save this item and move to the next one not yet counted (or the next in order).
  const saveAndNext = async (index: number) => {
    const line = lines[index];
    if (!line || !(await save(line.itemId))) return;
    const after = lines.findIndex((entry, i) => i > index && entry.counted === null && entry.itemId !== line.itemId);
    setCursor(after >= 0 ? after : Math.min(index + 1, lines.length - 1));
  };
  const current = lines[cursor];

  const run = async (action: 'submit' | 'approve') => {
    setBusy(action);
    const result = !store
      ? null
      : action === 'submit'
        ? await submitCount(store, sessionId, role)
        : await approveCount(store, sessionId, role);
    setBusy(null);
    if (!result?.ok) {
      toast({
        title: t(
          (result?.error.messageKey ??
            'errors.unexpected') as 'errors.unexpected',
        ),
      });
      return;
    }
    toast({
      title:
        action === 'submit'
          ? m.counts.submitted
          : t('counts.approved', {
              count: 'adjusted' in result.data ? result.data.adjusted : 0,
            }),
    });
  };

  const needle = query.trim().toLowerCase();
  const visible = lines.filter((line) => {
    if (onlyDifferences && !differences.includes(line)) return false;
    if (!needle) return true;
    return [
      line.item.nameTh,
      line.item.nameEn ?? '',
      line.item.sku,
      line.item.barcode ?? '',
    ].some((value) => value.toLowerCase().includes(needle));
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className={cn(ts('ui', locale), 'm-0 text-ink')}>
          {t('counts.progress', { done, total: lines.length })}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={lines.length}
          aria-valuenow={done}
          aria-label={t('counts.progress', { done, total: lines.length })}
          className="h-2 w-full overflow-hidden rounded-xs bg-surface-sunken"
        >
          <div
            className="h-full bg-product-accent"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {status !== 'open' ? (
        <div className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4">
          {status === 'submitted' ? (
            <>
              <h2 className={cn(ts('title', locale), 'm-0 text-ink')}>
                {m.counts.approvalTitle}
              </h2>
              <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
                {role === 'owner'
                  ? m.counts.approvalBody
                  : m.counts.waitingOwner}
              </p>
            </>
          ) : null}
          {differences.length === 0 ? (
            <p className={cn(ts('body-sm', locale), 'm-0 text-ink')}>
              {m.counts.noDifferences}
            </p>
          ) : role === 'owner' ? (
            <p
              className={cn(ts('ui', locale), 'm-0 text-ink')}
            >{`${m.counts.shrinkage}: ${formatMoney(shrinkage, locale)}`}</p>
          ) : null}
        </div>
      ) : null}

      {editable && current && phone ? (
        <section
          aria-labelledby="count-focus-title"
          className="flex flex-col gap-4 rounded-md border border-line bg-surface-raised p-4 md:hidden"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="count-focus-title" className={cn(ts('ui', locale), 'm-0 text-ink-muted')}>
              {m.counts.focusTitle}
            </h2>
            <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
              {t('counts.position', { n: cursor + 1, total: lines.length })}
            </span>
          </div>
          {done === lines.length ? (
            <p className={cn(ts('body', locale), 'm-0 text-ink')}>{m.counts.allCounted}</p>
          ) : null}
          <div>
            <p className={cn(ts('title', locale), 'm-0 text-ink')}>{nameIn(current.item, locale)}</p>
            <span className="code text-ink-muted">{current.item.sku}</span>
          </div>
          <dl className="m-0 grid grid-cols-2 gap-3">
            <div className="rounded-sm bg-surface-sunken p-3">
              <dt className={cn(ts('body-sm', locale), 'text-ink-muted')}>{m.counts.expected}</dt>
              <dd className="num m-0 text-2xl text-ink">
                {current.expected === null ? m.counts.hidden : formatQty(current.expected, current.item.baseUnit, locale)}
              </dd>
            </div>
            <div className="rounded-sm bg-surface-sunken p-3">
              <dt className={cn(ts('body-sm', locale), 'text-ink-muted')}>{m.counts.counted}</dt>
              <dd className="num m-0 text-2xl text-ink">
                {current.counted === null ? m.counts.notCounted : formatQty(current.counted, current.item.baseUnit, locale)}
              </dd>
            </div>
          </dl>
          <Stepper
            locale={locale}
            size="lg"
            value={drafts[current.itemId] ?? 0}
            onValueChange={(value) => setDrafts((all) => ({ ...all, [current.itemId]: value }))}
            min={0}
            aria-label={t('counts.countLabel', { item: nameIn(current.item, locale) })}
            className="num [&_input]:text-2xl"
          />
          <Button
            locale={locale}
            variant="primary"
            size="lg"
            className="w-full"
            loading={busy === current.itemId}
            onClick={() => void saveAndNext(cursor)}
          >
            {m.counts.saveNext}
          </Button>
          <div className="flex justify-between gap-2">
            <Button locale={locale} variant="ghost" disabled={cursor === 0} onClick={() => setCursor((i) => Math.max(0, i - 1))}>
              {m.counts.previous}
            </Button>
            <Button
              locale={locale}
              variant="ghost"
              disabled={cursor >= lines.length - 1}
              onClick={() => setCursor((i) => Math.min(lines.length - 1, i + 1))}
            >
              {m.counts.next}
            </Button>
          </div>
        </section>
      ) : null}

      {editable ? (
        <Button
          locale={locale}
          variant="secondary"
          className="md:hidden"
          aria-expanded={showAll}
          onClick={() => setShowAll((open) => !open)}
        >
          {showAll ? m.counts.hideAll : m.counts.showAll}
        </Button>
      ) : null}

      <div className={cn('flex flex-wrap items-end gap-4', editable && !showAll && 'max-md:hidden')}>
        <Field
          locale={locale}
          label={m.counts.searchLabel}
          className="min-w-[14rem] flex-1"
        >
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        {differences.length > 0 || status !== 'open' ? (
          <div className="flex min-h-11 items-center">
            <Checkbox
              locale={locale}
              label={m.counts.onlyDifferences}
              checked={onlyDifferences}
              onCheckedChange={setOnlyDifferences}
            />
          </div>
        ) : null}
      </div>

      <ul className={cn('m-0 flex list-none flex-col divide-y divide-line rounded-sm border border-line bg-surface-raised p-0', editable && !showAll && 'max-md:hidden')}>
        {visible.map((line) => {
          const name = nameIn(line.item, locale);
          const difference =
            line.counted !== null && line.expected !== null
              ? line.counted - line.expected
              : null;
          return (
            <li
              key={line.itemId}
              className={cn(
                'grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center',
                difference ? 'bg-warning-soft' : '',
              )}
            >
              <div className="min-w-0">
                <p className={cn(ts('ui', locale), 'm-0 text-ink')}>{name}</p>
                <dl
                  className={cn(
                    ts('body-sm', locale),
                    'm-0 mt-1 flex flex-wrap gap-x-5 gap-y-1 tabular-nums',
                  )}
                >
                  <div className="flex gap-1.5">
                    <dt className="text-ink-muted">{m.counts.expected}</dt>
                    <dd className="m-0 text-ink">
                      {line.expected === null
                        ? m.counts.hidden
                        : formatQty(line.expected, line.item.baseUnit, locale)}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-ink-muted">{m.counts.counted}</dt>
                    <dd className="m-0 text-ink">
                      {line.counted === null
                        ? m.counts.notCounted
                        : formatQty(line.counted, line.item.baseUnit, locale)}
                    </dd>
                  </div>
                  {difference !== null ? (
                    <div className="flex gap-1.5">
                      <dt className="text-ink-muted">{m.counts.difference}</dt>
                      <dd
                        className={cn(
                          'm-0',
                          difference
                            ? 'font-medium text-ink'
                            : 'text-ink-muted',
                        )}
                      >
                        {difference
                          ? formatSigned(difference, locale)
                          : formatQty(0, null, locale)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <span className="code text-ink-muted">{line.item.sku}</span>
              </div>
              {editable ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Stepper
                    locale={locale}
                    value={drafts[line.itemId] ?? 0}
                    onValueChange={(value) =>
                      setDrafts((current) => ({
                        ...current,
                        [line.itemId]: value,
                      }))
                    }
                    min={0}
                    aria-label={t('counts.countLabel', { item: name })}
                  />
                  <Button
                    locale={locale}
                    variant={line.counted === null ? 'secondary' : 'ghost'}
                    loading={busy === line.itemId}
                    aria-label={t('counts.saveLine', { item: name })}
                    onClick={() => void save(line.itemId)}
                  >
                    {line.counted === null ? (
                      m.common.save
                    ) : (
                      <>
                        <Check aria-hidden size={16} strokeWidth={1.75} />
                        {m.counts.lineSaved}
                      </>
                    )}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        {status === 'open' ? (
          <Button
            locale={locale}
            variant="primary"
            loading={busy === 'submit'}
            disabled={done < lines.length}
            onClick={() => void run('submit')}
          >
            {m.counts.submit}
          </Button>
        ) : null}
        {status === 'submitted' && role === 'owner' ? (
          <Button
            locale={locale}
            variant="primary"
            loading={busy === 'approve'}
            onClick={() => void run('approve')}
          >
            {m.counts.approve}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
