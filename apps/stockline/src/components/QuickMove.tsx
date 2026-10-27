'use client';

import { useRole } from '../client-store/role';
import type { Locale } from '@peera/i18n';
import {
  Button,
  cn,
  EmptyState,
  ErrorState,
  focusRing,
  Input,
  Skeleton,
  toast,
  ts,
} from '@peera/ui';
import { ScanLine, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMedia } from '../lib/use-media';
import {
  useItemViews,
  useStoreInstance,
  useStoreState,
} from '../client-store/hooks';
import { lowViews, movementViews, recentViews, searchViews } from '../client-store/views';
import type { ItemView } from '../domain/read-models';
import { nameIn, translator } from '../i18n';
import { formatQty, formatSigned, unitName } from '../lib/format';
import { AppLink } from './AppLink';
import { ItemRowContent } from './ItemRow';
import { MovementCards } from './Movements';
import { MoveForm, MovePanelHeader, MoveSheet, type SavedMovement } from './MoveSheet';
import { ScanOverlay } from './ScanOverlay';


const RECENT_KEY = 'stockline:recent';
const RECENT_LIMIT = 8;
const SEARCH_DELAY_MS = 150;

// Recent items are a per-browser convenience (localStorage); the ids are the store's item ids.
function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((id) => typeof id === 'string').slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]) {
  try {
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(ids.slice(0, RECENT_LIMIT)),
    );
  } catch {
    // Storage blocked: recent chips just don't persist.
  }
}

/** Quick move (02 §8 screen 1): search or scan, pick, record. Reads and writes the browser store. */
export function QuickMove({ locale }: { locale: Locale }) {
  const role = useRole();
  const { t, m } = translator(locale);
  const store = useStoreInstance();
  const { status, variant, ledger } = useStoreState();
  // ≥1024 the move form sits in a panel beside the list instead of a sheet (ux-v2/stockline.md V3).
  const desktop = useMedia('(min-width: 1024px)');
  const [formKey, setFormKey] = useState(0);
  // The row just saved flashes once; the count restarts the flash on a second save.
  const [flash, setFlash] = useState<{ id: string; count: number } | null>(null);
  const views = useItemViews(role);
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readRecent(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search, 150 ms (02 §6.3).
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const searching = Boolean(searchTerm.trim());
  const results = useMemo(
    () => searchViews(views, searchTerm),
    [views, searchTerm],
  );
  const low = useMemo(() => lowViews(views), [views]);
  const recent = useMemo(
    () => recentViews(views, recentIds).slice(0, 6),
    [views, recentIds],
  );
  const selected = views.find((entry) => entry.id === selectedId) ?? null;

  const open = (item: ItemView) => {
    setSelectedId(item.id);
    if (desktop) {
      setFormKey((key) => key + 1);
      return;
    }
    setSheetKey((key) => key + 1);
    setSheetOpen(true);
  };

  const onSettled = (
    change: SavedMovement,
    result: { ok: true; onHand: number } | { ok: false; messageKey: string },
  ) => {
    if (!result.ok) {
      toast({
        title: t('quickMove.failed', {
          reason: t(result.messageKey as 'errors.unexpected'),
        }),
      });
      return;
    }
    const item = views.find((entry) => entry.id === change.itemId);
    if (desktop) setFormKey((key) => key + 1);
    setFlash((current) => ({ id: change.itemId, count: (current?.count ?? 0) + 1 }));
    setRecentIds((ids) => {
      const next = [change.itemId, ...ids.filter((id) => id !== change.itemId)];
      writeRecent(next);
      return next.slice(0, RECENT_LIMIT);
    });
    if (item)
      toast({
        title: t('quickMove.saved', {
          type: m.types[change.type],
          item: nameIn(item, locale),
          qty: `${formatSigned(change.quantityBase, locale)} ${unitName(item.baseUnit, locale, change.quantityBase)}`,
        }),
      });
  };

  if (status === 'loading' && views.length === 0)
    return <Skeleton locale={locale} lines={6} />;

  if (status === 'error' && views.length === 0)
    return (
      <ErrorState
        locale={locale}
        title={m.quickMove.searchError}
        retryLabel={m.common.retry}
        onRetry={() => {
          if (store && variant) void store.load(variant);
        }}
      />
    );

  if (views.length === 0)
    return (
      <EmptyState
        locale={locale}
        title={m.quickMove.emptyTitle}
        description={m.quickMove.emptyBody}
        action={
          role === 'owner' ? (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <AppLink
                href={`/${locale}/import`}
                className={cn(
                  ts('ui', locale),
                  'inline-flex min-h-11 items-center rounded-sm bg-product-accent px-4 text-product-on-accent',
                  focusRing,
                )}
              >
                {m.quickMove.importAction}
              </AppLink>
              <AppLink
                href={`/${locale}/items/new`}
                className={cn(
                  ts('ui', locale),
                  'inline-flex min-h-11 items-center rounded-sm border border-line-strong px-4 text-ink',
                  focusRing,
                )}
              >
                {m.quickMove.addAction}
              </AppLink>
            </div>
          ) : null
        }
      />
    );

  const list = searching ? results : low;
  // On desktop the panel always shows an item: the one picked, else the first in the list.
  const panelItem = desktop ? (selected ?? list[0] ?? null) : null;
  const panelMoves =
    panelItem && ledger ? movementViews(ledger, role, { itemId: panelItem.id, limit: 5 }) : [];

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-col gap-5">
      {/* On phones the search and scan bar stays under the top bar while the list scrolls. */}
      <form
        role="search"
        className="sticky top-11 z-10 -mx-4 flex items-end gap-2 bg-surface px-4 py-2 md:static md:mx-0 md:bg-transparent md:p-0"
        onSubmit={(event) => {
          event.preventDefault();
          const first = results[0];
          if (first) open(first);
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={cn(ts('ui', locale), 'text-ink')}>
            {m.quickMove.searchLabel}
          </span>
          <span className="relative">
            <Search
              aria-hidden
              size={20}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
            />
            <Input
              ref={inputRef}
              locale={locale}
              type="search"
              inputMode="search"
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              placeholder={m.quickMove.searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-12 pr-11 pl-10"
            />
            {query ? (
              <button
                type="button"
                aria-label={m.common.clear}
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className={cn(
                  'absolute top-1/2 right-1 inline-flex min-h-10 min-w-10 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted hover:text-ink',
                  focusRing,
                )}
              >
                <X aria-hidden size={18} strokeWidth={1.75} />
              </button>
            ) : null}
          </span>
        </label>
        <Button
          locale={locale}
          size="lg"
          variant="secondary"
          onClick={() => {
            setScanKey((key) => key + 1);
            setScanOpen(true);
          }}
        >
          <ScanLine aria-hidden size={20} strokeWidth={1.75} />
          {m.quickMove.scan}
        </Button>
      </form>

      {recent.length > 0 ? (
        <section aria-labelledby="recent-title">
          <h2
            id="recent-title"
            className={cn(ts('ui', locale), 'm-0 mb-2 text-ink-muted')}
          >
            {m.quickMove.recent}
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {recent.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className={cn(
                    ts('ui', locale),
                    'inline-flex min-h-11 max-w-[16rem] items-center gap-2 rounded-sm border border-line-strong bg-surface-raised px-3 text-left text-ink hover:bg-surface-sunken',
                    focusRing,
                  )}
                >
                  <span className="truncate">{nameIn(item, locale)}</span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {formatQty(item.onHand, null, locale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="list-title">
        <h2
          id="list-title"
          className={cn(ts('ui', locale), 'm-0 mb-2 text-ink-muted')}
        >
          {searching ? m.quickMove.results : m.quickMove.lowFirst}
        </h2>
        {searching && results.length === 0 ? (
          <EmptyState
            locale={locale}
            title={t('quickMove.noResults', { query: searchTerm.trim() })}
            description={m.quickMove.noResultsHint}
          />
        ) : (
          <ul className="sl-stagger m-0 grid list-none gap-2 p-0 lg:gap-0 lg:divide-y lg:divide-line lg:overflow-hidden lg:rounded-md lg:border lg:border-line lg:bg-surface-raised">
            {list.map((item) => (
              <li key={item.id}>
                <button
                  key={flash?.id === item.id ? `flash-${flash.count}` : 'row'}
                  type="button"
                  onClick={() => open(item)}
                  aria-current={panelItem?.id === item.id ? 'true' : undefined}
                  className={cn(
                    'flex min-h-[4.5rem] w-full items-center rounded-md border border-line bg-surface-raised px-3 py-3 text-left hover:bg-surface-sunken',
                    'lg:min-h-16 lg:rounded-none lg:border-0 lg:py-2 aria-[current=true]:bg-primary-soft',
                    flash?.id === item.id && 'sl-flash',
                    focusRing,
                  )}
                >
                  <ItemRowContent item={item} locale={locale} emphasis />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      </div>

      {panelItem ? (
        <aside
          aria-label={m.quickMove.panelLabel}
          className="sticky top-[4.5rem] flex flex-col gap-6 rounded-md border border-line bg-surface-raised p-5"
        >
          <div>
            <MovePanelHeader item={panelItem} locale={locale} />
            <MoveForm
              key={`panel-${panelItem.id}-${formKey}`}
              item={panelItem}
              locale={locale}
              role={role}
              onSettled={onSettled}
            />
          </div>
          <section aria-labelledby="panel-moves" className="border-t border-line pt-4">
            <h3 id="panel-moves" className={cn(ts('ui', locale), 'm-0 mb-3 text-ink-muted')}>
              {m.quickMove.recentMoves}
            </h3>
            {panelMoves.length ? (
              <MovementCards rows={panelMoves} locale={locale} />
            ) : (
              <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>{m.quickMove.noMoves}</p>
            )}
          </section>
        </aside>
      ) : null}

      <MoveSheet
        key={`move-${sheetKey}`}
        item={selected}
        locale={locale}
        role={role}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSettled={onSettled}
      />
      <ScanOverlay
        key={`scan-${scanKey}`}
        locale={locale}
        role={role}
        open={scanOpen}
        onOpenChange={setScanOpen}
        onFound={(found) => {
          setScanOpen(false);
          open(found);
        }}
      />
    </div>
  );
}
