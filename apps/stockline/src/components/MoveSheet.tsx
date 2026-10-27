'use client';

import type { Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Field,
  focusRing,
  Input,
  SegmentedControl,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Stepper,
  Textarea,
  ts,
} from '@peera/ui';
import { OctagonAlert, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { recordMovement } from '../client-store/commands';
import { useStoreInstance } from '../client-store/hooks';
import type { ItemView } from '../domain/read-models';
import {
  checkNegativeStock,
  reasons,
  signedQuantity,
  toBase,
  type MovementType,
  type Role,
} from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { formatQty, unitName } from '../lib/format';
import { ChipGroup } from './ChipGroup';
import { ItemStatusBadge } from './ItemStatusBadge';
import { ItemThumb } from './ItemRow';
import { LabelStrip } from './LabelStrip';
import { RollingNumber } from './RollingNumber';

export type SavedMovement = {
  itemId: string;
  type: MovementType;
  quantityBase: number;
  onHand: number;
};

type Settled = (
  change: SavedMovement,
  result: { ok: true; onHand: number } | { ok: false; messageKey: string },
) => void;

const SEPARATOR = '·';

const defaultReason: Record<MovementType, string> = {
  in: 'received',
  out: 'sold',
  adjust: 'correction',
};

/** The item header: the label strip, the photo, name, code, what is on hand, and its status. */
function MoveHeader({
  item,
  locale,
  title,
  description,
}: {
  item: ItemView;
  locale: Locale;
  title: ReactNode;
  description: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <LabelStrip className="rounded-t-sm" />
      <div className="flex items-start gap-3 pr-10">
        <ItemThumb item={item} size={56} />
        <div className="min-w-0 flex-1">
          {title}
          {description}
          <div className="mt-2">
            <ItemStatusBadge status={item.status} locale={locale} />
          </div>
        </div>
        <span className="num shrink-0 text-right text-3xl leading-none text-ink">
          <RollingNumber value={item.onHand} format={(value) => formatQty(value, null, locale)} />
          <span className={cn(ts('body-sm', locale), 'mt-1 block font-normal text-ink-muted')}>
            {unitName(item.baseUnit, locale, item.onHand)}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * The movement form (02 §8 screen 1), shared by the phone sheet and the desktop panel. After picking an item, In is
 * one tap (Save), Out two (Out, Save), Adjust needs a direction and a note. Quick-add chips step by one unit or by
 * a pack. The save records an op in the browser store (`client-store/commands`), then `onSettled` reports the new
 * balance, or the error. Callers give it a new `key` per item, so every opening starts from the defaults.
 */
export function MoveForm({
  item,
  locale,
  role,
  onSubmitted,
  onSettled,
  initialType = 'in',
  stickySave = false,
}: {
  item: ItemView;
  locale: Locale;
  role: Role;
  /** Called as soon as the save is sent (the sheet closes here). */
  onSubmitted?: () => void;
  onSettled: Settled;
  initialType?: MovementType;
  /** Keep Save visible at the bottom of a scrolling sheet. */
  stickySave?: boolean;
}) {
  const { t, m } = translator(locale);
  const [type, setType] = useState<MovementType>(initialType);
  const [quantity, setQuantity] = useState(initialType === 'adjust' ? 0 : 1);
  const [unitId, setUnitId] = useState(item.baseUnit.id);
  const [reason, setReason] = useState(defaultReason[initialType]);
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [noteError, setNoteError] = useState(false);
  const store = useStoreInstance();

  const units = [
    { id: item.baseUnit.id, factor: 1, unit: item.baseUnit },
    ...item.packs.map((pack) => ({
      id: pack.unitId,
      factor: pack.factor,
      unit: pack.unit,
    })),
  ];
  const selected = units.find((entry) => entry.id === unitId) ?? units[0]!;
  let base = 0;
  try {
    base = signedQuantity(type, toBase(quantity, selected.factor));
  } catch {
    base = 0;
  }
  const after = item.onHand + base;
  const negative = checkNegativeStock(role, item.onHand, base);
  const typeLabel = m.types[type];
  // +1 and one chip per pack size, all in the base unit (ux-v2: "+1, +6, +12, +24 from the pack sizes").
  const steps = [...new Set([1, ...item.packs.map((pack) => pack.factor)])]
    .filter((step) => step > 0)
    .sort((a, b) => a - b)
    .slice(0, 4);

  const changeType = (next: string) => {
    const value = next as MovementType;
    setType(value);
    setReason(defaultReason[value]);
    setQuantity((current) =>
      value === 'adjust' ? 0 : Math.max(1, Math.abs(current) || 1),
    );
  };

  const quickAdd = (step: number) => {
    // The chips count in the base unit, so switch to it and keep what was already entered.
    const current = selected.factor === 1 ? quantity : quantity * selected.factor;
    setUnitId(item.baseUnit.id);
    setQuantity(Math.max(0, current) + step);
  };

  const save = () => {
    if (type === 'adjust' && !note.trim()) {
      setNoteError(true);
      return;
    }
    if (base === 0 || negative === 'block' || !store) return;
    const change = { itemId: item.id, type, quantityBase: base, onHand: after };
    onSubmitted?.();
    const cost = Number(unitCost.replace(/,/g, ''));
    void recordMovement(
      store,
      {
        itemId: item.id,
        type,
        reason,
        quantity,
        unitId: selected.id === item.baseUnit.id ? null : selected.id,
        note: note.trim() || undefined,
        reference: reference.trim() || undefined,
        unitCostBaht:
          role === 'owner' &&
          type === 'in' &&
          unitCost.trim() &&
          Number.isFinite(cost)
            ? cost
            : null,
      },
      role,
    ).then((result) =>
      onSettled(
        change,
        result.ok
          ? { ok: true, onHand: result.data.onHand }
          : { ok: false, messageKey: result.error.messageKey },
      ),
    );
  };

  return (
    <form
      className="mt-5 flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <SegmentedControl
        locale={locale}
        aria-label={m.quickMove.type}
        fullWidth
        value={type}
        onValueChange={changeType}
        options={[
          { value: 'in', label: m.types.in, tone: 'accent' },
          { value: 'out', label: m.types.out, tone: 'ink' },
          { value: 'adjust', label: m.types.adjust, tone: 'warning' },
        ]}
      />

      <div className="flex flex-col gap-2">
        <span id={`qty-${item.id}`} className={cn(ts('ui', locale), 'text-ink')}>
          {m.quickMove.quantity}
        </span>
        <Stepper
          locale={locale}
          size="lg"
          value={quantity}
          onValueChange={setQuantity}
          min={type === 'adjust' ? -1_000_000 : 0}
          max={1_000_000}
          aria-label={m.quickMove.quantity}
          aria-describedby={`conversion-${item.id}`}
          className="num [&_input]:text-2xl"
        />
        {type === 'adjust' ? (
          <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
            {m.quickMove.adjustHint}
          </p>
        ) : (
          <div role="group" aria-label={m.quickMove.quickAdd} className="flex flex-wrap gap-2">
            {steps.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => quickAdd(step)}
                className={cn(
                  'num inline-flex min-h-11 min-w-14 items-center justify-center rounded-sm border border-line-strong bg-surface-raised px-3 text-base text-ink hover:bg-surface-sunken',
                  focusRing,
                )}
              >
                {t('quickMove.addStep', { step })}
              </button>
            ))}
          </div>
        )}
      </div>

      {units.length > 1 ? (
        <ChipGroup
          locale={locale}
          legend={m.quickMove.unit}
          value={selected.id}
          onChange={setUnitId}
          chips={units.map((entry) => ({
            value: entry.id,
            label:
              entry.factor === 1
                ? t('quickMove.baseUnit', { unit: nameIn(entry.unit, locale) })
                : t('quickMove.packUnit', {
                    unit: nameIn(entry.unit, locale),
                    factor: entry.factor,
                  }),
          }))}
        />
      ) : null}

      <p
        id={`conversion-${item.id}`}
        aria-live="polite"
        className={cn(ts('body', locale), 'm-0 tabular-nums text-ink')}
      >
        {selected.factor > 1 ? (
          <span className="mr-3">
            {t('quickMove.conversion', {
              qty: formatQty(Math.abs(base), null, locale),
              unit: unitName(item.baseUnit, locale, Math.abs(base)),
            })}
          </span>
        ) : null}
        <span className="text-ink-muted">
          {t('quickMove.balanceAfter', {
            qty: formatQty(after, null, locale),
            unit: unitName(item.baseUnit, locale, after),
          })}
        </span>
      </p>

      {negative !== 'ok' ? (
        <p
          role={negative === 'block' ? 'alert' : 'status'}
          className={cn(
            ts('body-sm', locale),
            'm-0 flex items-start gap-2 rounded-sm p-3',
            negative === 'block' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
          )}
        >
          {negative === 'block' ? (
            <OctagonAlert aria-hidden size={16} strokeWidth={1.75} className="mt-1 shrink-0" />
          ) : (
            <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-1 shrink-0" />
          )}
          <span className="text-ink">
            {negative === 'block'
              ? t('quickMove.negativeBlocked', {
                  qty: formatQty(item.onHand, item.baseUnit, locale),
                })
              : m.quickMove.negativeWarn}
          </span>
        </p>
      ) : null}

      <ChipGroup
        locale={locale}
        legend={m.quickMove.reason}
        value={reason}
        onChange={setReason}
        chips={reasons[type].map((value) => ({ value, label: m.reasons[value] }))}
      />

      {type === 'adjust' ? (
        <Field
          locale={locale}
          label={m.quickMove.note}
          required
          error={noteError ? m.errors.noteRequired : undefined}
        >
          <Textarea
            rows={2}
            value={note}
            placeholder={m.quickMove.notePlaceholder}
            onChange={(event) => {
              setNote(event.target.value);
              if (event.target.value.trim()) setNoteError(false);
            }}
          />
        </Field>
      ) : null}

      <details className="group">
        <summary
          className={cn(
            ts('ui', locale),
            'min-h-11 cursor-pointer list-none rounded-sm py-2 text-ink underline underline-offset-4',
          )}
        >
          {m.quickMove.more}
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <Field locale={locale} label={`${m.quickMove.reference} (${m.common.optional})`}>
            <Input
              value={reference}
              maxLength={80}
              placeholder={m.quickMove.referencePlaceholder}
              onChange={(event) => setReference(event.target.value)}
            />
          </Field>
          {type !== 'adjust' ? (
            <Field locale={locale} label={`${m.quickMove.note} (${m.common.optional})`}>
              <Input
                value={note}
                maxLength={500}
                placeholder={m.quickMove.notePlaceholder}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          ) : null}
          {role === 'owner' && type === 'in' ? (
            <Field
              locale={locale}
              label={t('quickMove.unitCost', { unit: nameIn(item.baseUnit, locale) })}
              hint={m.quickMove.unitCostHint}
            >
              <Input
                inputMode="decimal"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
              />
            </Field>
          ) : null}
        </div>
      </details>

      <div
        className={cn(
          'flex flex-col gap-2',
          stickySave && 'sticky bottom-0 -mx-5 border-t border-line bg-surface-raised px-5 pt-3 pb-1',
        )}
      >
        <Button
          locale={locale}
          type="submit"
          variant="primary"
          size="lg"
          disabled={base === 0 || negative === 'block'}
          className="w-full"
        >
          {t('quickMove.save', { type: typeLabel })}
        </Button>
        <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
          {m.quickMove.undoNote}
        </p>
      </div>
    </form>
  );
}

/** The item header for the desktop panel (an h2, not a dialog title). */
export function MovePanelHeader({ item, locale }: { item: ItemView; locale: Locale }) {
  const { t } = translator(locale);
  return (
    <MoveHeader
      item={item}
      locale={locale}
      title={<h2 className={cn(ts('title', locale), 'm-0 text-ink')}>{nameIn(item, locale)}</h2>}
      description={
        <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
          <span className="code">{item.sku}</span>
          <span aria-hidden className="mx-1">
            {SEPARATOR}
          </span>
          {t('quickMove.sheetDescription', {
            qty: formatQty(item.onHand, item.baseUnit, locale),
            min: formatQty(item.minQty, item.baseUnit, locale),
          })}
        </p>
      }
    />
  );
}

/** The quick-move bottom sheet on phones and tablets: the item header and the movement form. */
export function MoveSheet({
  item,
  locale,
  role,
  open,
  onOpenChange,
  onSettled,
  initialType = 'in',
}: {
  item: ItemView | null;
  locale: Locale;
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettled: Settled;
  initialType?: MovementType;
}) {
  const { t } = translator(locale);
  if (!item) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent locale={locale} aria-describedby={`move-desc-${item.id}`}>
        <MoveHeader
          item={item}
          locale={locale}
          title={<SheetTitle locale={locale}>{nameIn(item, locale)}</SheetTitle>}
          description={
            <SheetDescription locale={locale} id={`move-desc-${item.id}`}>
              <span className="code">{item.sku}</span>
              <span aria-hidden className="mx-1">
                {SEPARATOR}
              </span>
              {t('quickMove.sheetDescription', {
                qty: formatQty(item.onHand, item.baseUnit, locale),
                min: formatQty(item.minQty, item.baseUnit, locale),
              })}
            </SheetDescription>
          }
        />
        <MoveForm
          item={item}
          locale={locale}
          role={role}
          initialType={initialType}
          stickySave
          onSubmitted={() => onOpenChange(false)}
          onSettled={onSettled}
        />
      </SheetContent>
    </Sheet>
  );
}
