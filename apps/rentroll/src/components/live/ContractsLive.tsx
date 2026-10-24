'use client';

import type { Locale } from '@peera/i18n';
import { formatMoney } from '@peera/i18n';
import { Button, cn, Field, focusRing, Input, Select, toast } from '@peera/ui';
import Link from 'next/link';
import { useCallback, useState, type FormEvent } from 'react';
import { getStore } from '@/src/client-store/instance';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import { actMoveIn, actMoveOut } from '@/src/client-store/commands/contracts';
import { actGiveNotice } from '@/src/client-store/commands/property';
import {
  contractDetail,
  contractsList,
  moveInPreview,
  moveOutPreview,
  tenantsList,
} from '@/src/client-store/selectors/property';
import type { StoreState } from '@/src/client-store/store';
import { roomStatus } from '@/src/domain/property';
import { CHECKLIST_KEYS, CHECKLIST_LABELS } from '@/src/domain/move';
import { translator, type Messages } from '@/src/i18n';
import { PageHeader } from '@/src/components/PageHeader';
import { ReadyGate } from './ReadyGate';
import { Dot, KV } from './KV';

const todayOf = (s: StoreState) => s.snapshotDate ?? '';
const toSatang = (raw: string) =>
  Math.round(Number(raw.replace(/,/g, '')) * 100) || 0;
const errorText = (m: Messages, key: string) =>
  m.contracts.errors[
    key.split('.').pop() as keyof Messages['contracts']['errors']
  ] ?? m.contracts.errors.saveFailed;

/** Tenants: renter profiles with their current room. Search by name. */
export function TenantsLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <TenantsBody locale={locale} />
    </ReadyGate>
  );
}

function TenantsBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.contracts.tenants;
  const select = useCallback(
    (s: StoreState) =>
      s.snapshotDate ? tenantsList(s.data, s.snapshotDate) : [],
    [],
  );
  const all = useStore(select);
  const [query, setQuery] = useState('');
  const rows = all.filter((r) =>
    r.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <label className="mb-4 flex flex-col gap-1 text-ink-muted">
        <span>{p.name}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-11 w-full max-w-sm rounded-sm border border-line-strong bg-surface-raised px-3 text-ink"
        />
      </label>
      {rows.length === 0 ? <p className="text-ink-muted">{p.none}</p> : null}
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li
            key={r.id}
            className="grid gap-x-4 border-b border-line px-3 py-3 odd:bg-surface-sunken md:grid-cols-3"
          >
            <span className="text-ink">{r.name}</span>
            <span className="tabular-nums text-ink-muted">
              {r.phone ?? m.contracts.blank}
            </span>
            <span className="tabular-nums text-ink">
              {r.roomNumber ?? m.contracts.blank}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Contracts list (SPEC §4 O6). */
export function ContractsLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <ContractsBody locale={locale} />
    </ReadyGate>
  );
}

function ContractsBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.contracts;
  const rows = useStore(
    useCallback((s: StoreState) => contractsList(s.data), []),
  );
  if (rows.length === 0) return <p className="text-ink-muted">{p.empty}</p>;
  return (
    <ul className="flex flex-col">
      {rows.map((c) => (
        <li
          key={c.id}
          className="grid gap-x-4 gap-y-1 border-b border-line px-3 py-3 odd:bg-surface-sunken md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
        >
          <span className="tabular-nums text-ink">{c.roomNumber}</span>
          <span className="text-ink">{c.renterName ?? m.contracts.blank}</span>
          <span className="tabular-nums text-ink-muted">{c.startDate}</span>
          <span className="text-ink-muted">
            {p.status[c.status as keyof typeof p.status] ?? c.status}
          </span>
          <Link
            href={`/${locale}/owner/contracts/${c.id}`}
            className={cn(
              'min-h-11 rounded-sm px-2 text-ink underline-offset-4 hover:underline',
              focusRing,
            )}
          >
            {p.detail.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** One contract (SPEC §4 O6): terms, renters, invoices, checklists and the settlement; give notice; move out. */
export function ContractDetailLive({
  locale,
  contractId,
}: {
  locale: Locale;
  contractId: string;
}) {
  return (
    <ReadyGate locale={locale}>
      <ContractDetailBody locale={locale} contractId={contractId} />
    </ReadyGate>
  );
}

function ContractDetailBody({
  locale,
  contractId,
}: {
  locale: Locale;
  contractId: string;
}) {
  const { m } = translator(locale);
  const p = m.contracts.detail;
  const detail = useStore(
    useCallback(
      (s: StoreState) => contractDetail(s.data, contractId),
      [contractId],
    ),
  );
  const today = useStore(todayOf);
  const role = useRole();
  const [notice, setNotice] = useState(today);
  if (!detail)
    return <p className="text-ink-muted">{m.contracts.errors.notFound}</p>;
  const c = detail.contract;
  const canNotice = c.status === 'active' && role === 'owner';
  const canMoveOut = c.status !== 'ended' && role === 'owner';

  return (
    <>
      <PageHeader locale={locale} title={`${p.title} · ${detail.roomNumber}`} />
      <section className="mb-6 grid gap-3 rounded-sm border border-line bg-surface-raised p-4 md:grid-cols-2">
        <p className="text-ink">
          <KV label={p.rent}>
            <span className="tabular-nums">
              {formatMoney(c.monthlyRentSatang, locale)}
            </span>
          </KV>
        </p>
        <p className="text-ink">
          <KV label={p.deposit}>
            <span className="tabular-nums">
              {formatMoney(c.depositSatang, locale)}
            </span>
          </KV>
        </p>
        <p className="tabular-nums text-ink-muted">
          <KV label={p.start}>{c.startDate}</KV>
          <Dot />
          <KV label={p.end}>{c.endDate ?? m.contracts.blank}</KV>
        </p>
        <p className="text-ink-muted">
          {m.contracts.status[c.status as keyof typeof m.contracts.status] ??
            c.status}
        </p>
        <ul className="text-ink md:col-span-2">
          {detail.renters.map((r) => (
            <li key={r.name}>
              {r.name}{' '}
              {r.isPrimary ? (
                <span className="text-ink-muted">{p.primary}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {canNotice ? (
        <form
          className="mb-6 flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const result = actGiveNotice(
              { store: getStore(), role, now: () => new Date() },
              { contractId, noticeDate: notice },
            );
            toast({
              title: result.ok
                ? m.ownerLive.noticeSaved
                : errorText(m, result.error),
            });
          }}
        >
          <Field label={p.noticeDate} locale={locale}>
            <Input
              type="date"
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="secondary" locale={locale}>
            {p.giveNotice}
          </Button>
        </form>
      ) : null}
      {canMoveOut ? (
        <Link
          href={`/${locale}/owner/move-out/${contractId}`}
          className={cn(
            'mb-6 inline-flex min-h-11 items-center text-ink underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          {p.moveOut}
        </Link>
      ) : null}

      <section className="mb-6 flex flex-col gap-2">
        <h2 className="text-ink">{p.invoices}</h2>
        {detail.invoices.length === 0 ? (
          <p className="text-ink-muted">{p.noInvoices}</p>
        ) : null}
        <ul className="flex flex-col gap-1">
          {detail.invoices.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 text-ink">
              <span className="tabular-nums">{i.number}</span>
              <span className="tabular-nums">
                {formatMoney(i.totalSatang, locale)}
              </span>
              <span className="text-ink-muted">
                {m.billing.status[i.status as keyof typeof m.billing.status] ??
                  i.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 flex flex-col gap-2">
        <h2 className="text-ink">{p.checklists}</h2>
        {detail.checklists.map((cl) => (
          <div key={cl.id} className="flex flex-col gap-1">
            <span className="text-ink-muted">{cl.kind}</span>
            <ul className="flex flex-col gap-1">
              {(
                cl.items as {
                  key: string;
                  labelTh: string;
                  labelEn: string;
                  status: string | null;
                }[]
              ).map((item) => (
                <li
                  key={item.key}
                  className="flex justify-between gap-3 text-ink"
                >
                  <span>{locale === 'th' ? item.labelTh : item.labelEn}</span>
                  <span className="text-ink-muted">
                    {item.status
                      ? m.contracts.checklist[item.status as 'ok' | 'damaged']
                      : m.contracts.checklist.none}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-ink">{p.settlement}</h2>
        {detail.settlement ? (
          <p className="tabular-nums text-ink">
            <KV label={p.deposit}>
              {formatMoney(detail.settlement.depositSatang, locale)}
            </KV>
            <Dot />
            <KV label={m.contracts.moveOut.refund}>
              {formatMoney(detail.settlement.refundSatang, locale)}
            </KV>
          </p>
        ) : (
          <p className="text-ink-muted">{p.noSettlement}</p>
        )}
      </section>
    </>
  );
}

const vacantRoomsView = (s: StoreState) => {
  const today = s.snapshotDate ?? '';
  return s.data.room
    .filter(
      (r) =>
        roomStatus({
          maintenance: r.maintenance,
          contracts: s.data.contract.filter((c) => c.roomId === r.id),
          today,
        }) === 'vacant',
    )
    .map((r) => {
      const type = s.data.room_type.find((t) => t.id === r.roomTypeId);
      return {
        id: r.id,
        number: r.number,
        rent: type?.monthlyRentSatang ?? 0,
        deposit: type?.depositSatang ?? 0,
        advance: type?.advanceMonths ?? 1,
      };
    });
};

/** Move-in (SPEC §4 O7): the total is shown first, then the renter, the terms, the starting meters and the checklist. */
export function MoveInLive({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <MoveInBody locale={locale} />
    </ReadyGate>
  );
}

function MoveInBody({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const p = m.contracts.moveIn;
  const w = m.ownerEdits;
  const vacant = useStore(vacantRoomsView);
  const today = useStore(todayOf);
  const role = useRole();
  const [roomId, setRoomId] = useState<string | null>(null);
  const room = vacant.find((r) => r.id === roomId) ?? vacant[0];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [rent, setRent] = useState<string | null>(null);
  const [deposit, setDeposit] = useState<string | null>(null);
  const [advance, setAdvance] = useState<string | null>(null);
  const [elec, setElec] = useState('');
  const [water, setWater] = useState('');
  const [checks, setChecks] = useState<Record<string, 'ok' | 'damaged' | null>>(
    {},
  );
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<string | null>(null);

  if (vacant.length === 0)
    return <p className="text-ink-muted">{p.noVacant}</p>;
  const start = startDate || today;
  const rentSatang = rent !== null ? toSatang(rent) : (room?.rent ?? 0);
  const depositSatang =
    deposit !== null ? toSatang(deposit) : (room?.deposit ?? 0);
  const advanceMonths =
    advance !== null ? Number(advance) : (room?.advance ?? 1);
  const total = start
    ? moveInPreview({
        monthlyRentSatang: rentSatang,
        startDate: start,
        depositSatang,
        advanceMonths,
      })
    : null;
  const stepLabels = [
    w.wizardRoom,
    w.wizardTerms,
    w.wizardChecklist,
    w.wizardReview,
  ];
  const last = step === stepLabels.length - 1;
  // Each step has to be complete before the owner moves on; the review step is always complete.
  const stepValid = [
    Boolean(room) && name.trim() !== '',
    Boolean(start) && elec.trim() !== '' && water.trim() !== '',
    true,
    true,
  ];
  const counter = `${step + 1} / ${stepLabels.length}`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!last) {
      if (stepValid[step]) setStep(step + 1);
      return;
    }
    if (!room || !stepValid.every(Boolean)) return;
    const result = actMoveIn(
      { store: getStore(), role, now: () => new Date() },
      {
        roomId: room.id,
        renter: { mode: 'new', name: name.trim(), phone: phone.trim() || null },
        startDate: start,
        monthlyRentSatang: rentSatang,
        depositSatang,
        advanceMonths,
        occupants: 1,
        parkingSatang: 0,
        internetSatang: 0,
        elecReading: Number(elec || 0),
        waterReading: Number(water || 0),
        checklist: CHECKLIST_KEYS.map((key) => ({
          key,
          status: checks[key] ?? null,
        })),
      },
    );
    if (!result.ok) return toast({ title: errorText(m, result.error) });
    setDone(result.value.invoiceNumber);
    toast({ title: m.ownerLive.moveInDone });
  };

  if (done)
    return (
      <p className="text-ink">
        {m.ownerLive.moveInDone}
        <Dot />
        <span className="tabular-nums">{done}</span>
      </p>
    );
  return (
    <form onSubmit={submit} lang={locale} className="flex flex-col gap-6">
      <PageHeader locale={locale} title={p.title} description={p.intro} />
      <div className="rounded-sm border border-line bg-surface-raised p-4">
        <p className="text-ink-muted">{m.ownerLive.moveInTotal}</p>
        <p className="tabular-nums text-ink" aria-live="polite">
          {total ? formatMoney(total.total, locale) : m.contracts.blank}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <ol aria-label={counter} className="flex flex-wrap gap-2">
          {stepLabels.map((text, i) => (
            <li
              key={text}
              aria-current={i === step ? 'step' : undefined}
              className={cn(
                'rounded-sm border px-3 py-2',
                i === step
                  ? 'border-ink bg-surface-sunken text-ink'
                  : 'border-line bg-surface-raised text-ink-muted',
              )}
            >
              {text}
            </li>
          ))}
        </ol>
        <p className="tabular-nums text-ink-muted">{counter}</p>
      </div>

      {step === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={p.room} locale={locale} required>
            <Select
              locale={locale}
              value={room?.id ?? ''}
              onValueChange={setRoomId}
              options={vacant.map((r) => ({ value: r.id, label: r.number }))}
            />
          </Field>
          <Field label={p.renterName} locale={locale} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label={p.renterPhone} locale={locale}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={p.startDate} locale={locale} required>
            <Input
              type="date"
              value={start}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>
          <Field label={p.monthlyRent} locale={locale} required>
            <Input
              inputMode="decimal"
              value={(rentSatang / 100).toFixed(2)}
              onChange={(e) => setRent(e.target.value)}
            />
          </Field>
          <Field label={p.deposit} locale={locale} required>
            <Input
              inputMode="decimal"
              value={(depositSatang / 100).toFixed(2)}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </Field>
          <Field label={p.advanceMonths} locale={locale} required>
            <Input
              inputMode="numeric"
              value={String(advanceMonths)}
              onChange={(e) => setAdvance(e.target.value)}
            />
          </Field>
          <Field label={p.elecReading} locale={locale} required>
            <Input
              inputMode="numeric"
              value={elec}
              onChange={(e) => setElec(e.target.value)}
              required
            />
          </Field>
          <Field label={p.waterReading} locale={locale} required>
            <Input
              inputMode="numeric"
              value={water}
              onChange={(e) => setWater(e.target.value)}
              required
            />
          </Field>
        </div>
      ) : null}

      {step === 2 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-ink">{p.checklist}</legend>
          <p className="text-ink-muted">{p.checklistIntro}</p>
          {CHECKLIST_KEYS.map((key) => (
            <label
              key={key}
              className="flex min-h-11 flex-wrap items-center justify-between gap-3 text-ink"
            >
              <span>
                {locale === 'th'
                  ? CHECKLIST_LABELS[key].th
                  : CHECKLIST_LABELS[key].en}
              </span>
              <select
                value={checks[key] ?? ''}
                onChange={(e) =>
                  setChecks((prev) => ({
                    ...prev,
                    [key]: (e.target.value || null) as 'ok' | 'damaged' | null,
                  }))
                }
                className="min-h-11 rounded-sm border border-line-strong bg-surface-raised px-3 text-ink"
              >
                <option value="">{m.contracts.checklist.none}</option>
                <option value="ok">{m.contracts.checklist.ok}</option>
                <option value="damaged">{m.contracts.checklist.damaged}</option>
              </select>
            </label>
          ))}
        </fieldset>
      ) : null}

      {last ? (
        <dl className="grid grid-cols-2 gap-4 rounded-sm border border-line bg-surface-raised p-4">
          {(
            [
              [p.room, room?.number ?? m.contracts.blank],
              [p.renterName, name.trim() || m.contracts.blank],
              [p.startDate, start || m.contracts.blank],
              [p.monthlyRent, formatMoney(rentSatang, locale)],
              [p.deposit, formatMoney(depositSatang, locale)],
              [p.advanceMonths, String(advanceMonths)],
              [
                m.ownerLive.moveInTotal,
                total ? formatMoney(total.total, locale) : m.contracts.blank,
              ],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="m-0 tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            locale={locale}
            onClick={() => setStep(step - 1)}
          >
            {w.wizardBack}
          </Button>
        ) : (
          <span />
        )}
        {last ? (
          <Button
            type="submit"
            variant="primary"
            locale={locale}
            disabled={!stepValid.every(Boolean)}
          >
            {p.submit}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            locale={locale}
            disabled={!stepValid[step]}
            onClick={() => setStep(step + 1)}
          >
            {w.wizardNext}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Move-out (SPEC §4 O8): the final readings and checklist, the settlement preview, then confirm. */
export function MoveOutLive({
  locale,
  contractId,
}: {
  locale: Locale;
  contractId: string;
}) {
  return (
    <ReadyGate locale={locale}>
      <MoveOutBody locale={locale} contractId={contractId} />
    </ReadyGate>
  );
}

function MoveOutBody({
  locale,
  contractId,
}: {
  locale: Locale;
  contractId: string;
}) {
  const { m } = translator(locale);
  const p = m.contracts.moveOut;
  const today = useStore(todayOf);
  const role = useRole();
  const [date, setDate] = useState('');
  const [elec, setElec] = useState('');
  const [water, setWater] = useState('');
  const [elecRoll, setElecRoll] = useState(false);
  const [waterRoll, setWaterRoll] = useState(false);
  const [damages, setDamages] = useState('0');
  const [cleaning, setCleaning] = useState('0');
  const [checks, setChecks] = useState<Record<string, 'ok' | 'damaged' | null>>(
    {},
  );
  const [done, setDone] = useState(false);
  const input = {
    contractId,
    moveOutDate: date || today,
    elecReading: Number(elec || 0),
    waterReading: Number(water || 0),
    elecRollover: elecRoll,
    waterRollover: waterRoll,
    damages: toSatang(damages),
    cleaningFee: toSatang(cleaning),
  };
  const key = JSON.stringify(input);
  const preview = useStore(
    useCallback(
      (s: StoreState) => {
        const parsed = JSON.parse(key) as typeof input;
        return s.snapshotDate &&
          parsed.elecReading > 0 &&
          parsed.waterReading > 0
          ? moveOutPreview(s.data, parsed)
          : null;
      },
      [key],
    ),
  );

  if (done) return <p className="text-ink">{p.confirmed}</p>;
  return (
    <form
      lang={locale}
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const result = actMoveOut(
          { store: getStore(), role, now: () => new Date() },
          {
            ...input,
            checklist: CHECKLIST_KEYS.map((key) => ({
              key,
              status: checks[key] ?? null,
            })),
          },
        );
        if (!result.ok) return toast({ title: errorText(m, result.error) });
        setDone(true);
      }}
    >
      <PageHeader locale={locale} title={p.title} description={p.intro} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={p.moveOutDate} locale={locale} required>
          <Input
            type="date"
            value={date || today}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label={p.elecReading} locale={locale} required>
          <Input
            inputMode="numeric"
            value={elec}
            onChange={(e) => setElec(e.target.value)}
            required
          />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-ink">
          <input
            type="checkbox"
            checked={elecRoll}
            onChange={(e) => setElecRoll(e.target.checked)}
            className="size-5"
          />
          <span>{p.elecRollover}</span>
        </label>
        <Field label={p.waterReading} locale={locale} required>
          <Input
            inputMode="numeric"
            value={water}
            onChange={(e) => setWater(e.target.value)}
            required
          />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-ink">
          <input
            type="checkbox"
            checked={waterRoll}
            onChange={(e) => setWaterRoll(e.target.checked)}
            className="size-5"
          />
          <span>{p.waterRollover}</span>
        </label>
        <Field label={p.damages} locale={locale}>
          <Input
            inputMode="decimal"
            value={damages}
            onChange={(e) => setDamages(e.target.value)}
          />
        </Field>
        <Field label={p.cleaning} locale={locale}>
          <Input
            inputMode="decimal"
            value={cleaning}
            onChange={(e) => setCleaning(e.target.value)}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-ink">{p.checklist}</legend>
        <p className="text-ink-muted">{p.checklistIntro}</p>
        {CHECKLIST_KEYS.map((key) => (
          <label
            key={key}
            className="flex min-h-11 flex-wrap items-center justify-between gap-3 text-ink"
          >
            <span>
              {locale === 'th'
                ? CHECKLIST_LABELS[key].th
                : CHECKLIST_LABELS[key].en}
            </span>
            <select
              value={checks[key] ?? ''}
              onChange={(e) =>
                setChecks((prev) => ({
                  ...prev,
                  [key]: (e.target.value || null) as 'ok' | 'damaged' | null,
                }))
              }
              className="min-h-11 rounded-sm border border-line-strong bg-surface-raised px-3 text-ink"
            >
              <option value="">{m.contracts.checklist.none}</option>
              <option value="ok">{m.contracts.checklist.ok}</option>
              <option value="damaged">{m.contracts.checklist.damaged}</option>
            </select>
          </label>
        ))}
      </fieldset>
      <section
        className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-4"
        aria-live="polite"
      >
        <h2 className="text-ink">{p.settlementTitle}</h2>
        {preview ? (
          <SettlementLines locale={locale} m={m} preview={preview} />
        ) : (
          <p className="text-ink-muted">{m.contracts.blank}</p>
        )}
      </section>
      <div>
        <Button
          type="submit"
          variant="primary"
          locale={locale}
          disabled={!preview}
        >
          {p.confirm}
        </Button>
      </div>
    </form>
  );
}

type Preview = NonNullable<ReturnType<typeof moveOutPreview>>;

function SettlementLines({
  locale,
  m,
  preview,
}: {
  locale: Locale;
  m: Messages;
  preview: Preview;
}) {
  const p = m.contracts.moveOut;
  const r = preview.result;
  return (
    <ul className="flex flex-col gap-1 tabular-nums text-ink">
      <li>
        <KV label={p.units}>
          {p.electricity} {r.units.electricity}
          <Dot />
          {p.water} {r.units.water}
        </KV>
      </li>
      <li>
        <KV label={p.utilities}>
          {formatMoney(r.utilities.electricity + r.utilities.water, locale)}
        </KV>
      </li>
      <li>
        <KV label={p.deposit}>
          {formatMoney(preview.contract.depositReceivedSatang, locale)}
        </KV>
      </li>
      {r.deductions.map((d) => (
        <li key={d.kind}>
          <KV label={d.kind}>{formatMoney(d.amount, locale)}</KV>
        </li>
      ))}
      <li className="font-semibold">
        <KV label={r.refund >= 0 ? p.refund : p.owed}>
          {formatMoney(Math.abs(r.refund), locale)}
        </KV>
      </li>
    </ul>
  );
}
