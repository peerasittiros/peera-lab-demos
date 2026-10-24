import { describe, expect, it } from 'vitest';
import { memoryPersistence } from './idb';
import {
  actAdjustDraftLines,
  actGenerateBilling,
  actSendBilling,
  actVoidDraft,
} from './commands/billing';
import { actSaveReading } from './commands/meters';
import type { CommandContext } from './commands/payments';
import {
  billingPlan,
  invoiceDocument,
  invoiceList,
  visitorInvoiceIds,
} from './selectors/billing';
import { meterRound } from './selectors/meters';
import { createStore, type Store } from './store';
import { snapshotFor } from './testing';
import type { Role } from './schema';
import {
  decodeInvoiceLink,
  encodeInvoiceLink,
} from '@/src/domain/invoice-link';
import { readingFor } from '@/src/domain/meter-reading';

const TODAY = '2026-10-24';
const PERIOD = '2026-10';

async function readyStore(): Promise<Store> {
  const store = createStore({
    openPersistence: async () => memoryPersistence(),
    fetchSnapshot: async () => snapshotFor(TODAY),
    openSync: () => null,
    today: () => TODAY,
  });
  await store.start();
  return store;
}

const ctx = (store: Store, role: Role): CommandContext => ({
  store,
  role,
  now: () => new Date('2026-10-24T05:00:00.000Z'),
});

const buildingOf = (store: Store) => store.getState().data.building[0]!;

describe('meter reading (readingFor)', () => {
  it('refuses a future month, too many digits, and a lower reading without a rollover', () => {
    const history = [{ period: '2026-09', reading: 9990, unitsUsed: null }];
    expect(
      readingFor(
        history,
        { period: '2026-11', reading: 1, rollover: false },
        5,
        TODAY,
      ),
    ).toEqual({
      ok: false,
      error: 'meters.errors.future',
    });
    expect(
      readingFor(
        history,
        { period: PERIOD, reading: 100000, rollover: false },
        5,
        TODAY,
      ),
    ).toEqual({
      ok: false,
      error: 'meters.errors.invalid',
    });
    expect(
      readingFor(
        history,
        { period: PERIOD, reading: 10, rollover: false },
        5,
        TODAY,
      ),
    ).toEqual({
      ok: false,
      error: 'meters.errors.lowerNeedsRollover',
    });
  });

  it('works out units and flags a reading far above the average', () => {
    const history = [
      { period: '2026-07', reading: 100, unitsUsed: 100 },
      { period: '2026-08', reading: 200, unitsUsed: 100 },
      { period: '2026-09', reading: 300, unitsUsed: 100 },
    ];
    const result = readingFor(
      history,
      { period: PERIOD, reading: 600, rollover: false },
      5,
      TODAY,
    );
    expect(result).toEqual({
      ok: true,
      unitsUsed: 300,
      anomaly: 'above_double_average',
    });
  });
});

describe('meter round', () => {
  it('saves a reading into the round and reads it back', async () => {
    const store = await readyStore();
    const room = store.getState().data.room.find((r) => !r.maintenance)!;
    const before = meterRound(
      store.getState().data,
      room.buildingId,
      'electricity',
      PERIOD,
    ).find((r) => r.roomId === room.id)!;
    const reading = (before.previous ?? 0) + 10;
    const result = actSaveReading(ctx(store, 'caretaker'), {
      roomId: room.id,
      meterKind: 'electricity',
      period: PERIOD,
      reading,
      rollover: false,
    });
    expect(result.ok).toBe(true);
    const row = meterRound(
      store.getState().data,
      room.buildingId,
      'electricity',
      PERIOD,
    ).find((r) => r.roomId === room.id);
    expect(row?.current).toBe(reading);
  });

  it('refuses a tenant', async () => {
    const store = await readyStore();
    const room = store.getState().data.room[0]!;
    expect(
      actSaveReading(ctx(store, 'tenant'), {
        roomId: room.id,
        meterKind: 'water',
        period: PERIOD,
        reading: 1,
        rollover: false,
      }),
    ).toEqual({ ok: false, error: 'errors.forbidden' });
  });
});

describe('billing run', () => {
  it('blocks generation while a reading is missing, and generates once every room is read', async () => {
    const store = await readyStore();
    const building = buildingOf(store);
    const before = billingPlan(
      store.getState().data,
      building.id,
      PERIOD,
      TODAY,
    )!;
    const missing = before.rooms.filter(
      (r) =>
        !r.existingInvoiceId &&
        (r.electricity?.current == null || r.water?.current == null),
    );
    if (missing.length > 0) {
      const blocked = actGenerateBilling(ctx(store, 'owner'), {
        buildingId: building.id,
        period: PERIOD,
        estimateRoomIds: [],
      });
      expect(blocked).toEqual({
        ok: false,
        error: 'billing.errors.missingReadings',
      });
    }
    const estimates = missing.map((r) => r.roomId);
    const generated = actGenerateBilling(ctx(store, 'owner'), {
      buildingId: building.id,
      period: PERIOD,
      estimateRoomIds: estimates,
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    expect(generated.value.created).toBeGreaterThan(0);
    const drafts = store
      .getState()
      .data.invoice.filter((i) => i.status === 'draft' && i.period === PERIOD);
    expect(drafts.length).toBe(generated.value.created);
    expect(drafts[0]!.number).toMatch(/^INV-2569-10-\d{4}$/);
  });

  it('adjusts a draft, voids a draft, and sends the rest; a sent invoice is locked', async () => {
    const store = await readyStore();
    const building = buildingOf(store);
    const estimates = billingPlan(
      store.getState().data,
      building.id,
      PERIOD,
      TODAY,
    )!
      .rooms.filter((r) => !r.existingInvoiceId)
      .map((r) => r.roomId);
    actGenerateBilling(ctx(store, 'owner'), {
      buildingId: building.id,
      period: PERIOD,
      estimateRoomIds: estimates,
    });
    const [first, second] = store
      .getState()
      .data.invoice.filter((i) => i.status === 'draft' && i.period === PERIOD);
    if (!first || !second) throw new Error('expected two drafts');

    const lines = store
      .getState()
      .data.invoice_line.filter((l) => l.invoiceId === first.id)
      .map((l) => ({
        id: l.id,
        kind: l.kind as 'rent',
        labelTh: l.labelTh,
        labelEn: l.labelEn,
        amountSatang: l.amountSatang,
        meta: l.meta,
      }));
    const adjusted = actAdjustDraftLines(ctx(store, 'owner'), {
      invoiceId: first.id,
      lines: [
        ...lines,
        {
          kind: 'extra',
          labelTh: 'ค่าเปลี่ยนกุญแจ',
          labelEn: 'Key change',
          amountSatang: 30000,
        },
      ],
    });
    expect(adjusted).toEqual({
      ok: true,
      value: { totalSatang: first.totalSatang + 30000 },
    });

    expect(actVoidDraft(ctx(store, 'owner'), { invoiceId: second.id }).ok).toBe(
      true,
    );
    const sent = actSendBilling(ctx(store, 'owner'), {
      buildingId: building.id,
      period: PERIOD,
    });
    expect(sent.ok && sent.value.sent).toBeGreaterThan(0);
    expect(
      store.getState().data.invoice.find((i) => i.id === first.id)?.status,
    ).toBe('sent');
    expect(
      store.getState().data.invoice.find((i) => i.id === second.id)?.status,
    ).toBe('void');
    expect(
      actAdjustDraftLines(ctx(store, 'owner'), {
        invoiceId: first.id,
        lines: [],
      }),
    ).toEqual({
      ok: false,
      error: 'billing.errors.notDraft',
    });
    expect(actVoidDraft(ctx(store, 'owner'), { invoiceId: first.id })).toEqual({
      ok: false,
      error: 'billing.errors.notDraft',
    });
  });

  it('is owner-only, and the invoice list and the visitor set follow the run', async () => {
    const store = await readyStore();
    const building = buildingOf(store);
    expect(
      actGenerateBilling(ctx(store, 'caretaker'), {
        buildingId: building.id,
        period: PERIOD,
        estimateRoomIds: [],
      }),
    ).toEqual({
      ok: false,
      error: 'errors.forbidden',
    });
    const estimates = billingPlan(
      store.getState().data,
      building.id,
      PERIOD,
      TODAY,
    )!
      .rooms.filter((r) => !r.existingInvoiceId)
      .map((r) => r.roomId);
    actGenerateBilling(ctx(store, 'owner'), {
      buildingId: building.id,
      period: PERIOD,
      estimateRoomIds: estimates,
    });
    const created = store.getState().ops.at(-1);
    expect(created?.kind).toBe('billing.generate');
    if (created?.kind !== 'billing.generate') return;
    expect(visitorInvoiceIds(store.getState().ops).size).toBe(
      created.payload.invoices.length,
    );
    expect(
      invoiceList(store.getState().data).some((i) => i.status === 'draft'),
    ).toBe(true);
    const document = invoiceDocument(
      store.getState().data,
      created.payload.invoices[0]!.id,
    );
    expect(document?.lines.length).toBeGreaterThan(0);
  });
});

describe('invoice link', () => {
  it('round-trips an invoice through the fragment', async () => {
    const store = await readyStore();
    const invoice = store
      .getState()
      .data.invoice.find((i) => i.status === 'sent')!;
    const document = invoiceDocument(store.getState().data, invoice.id)!;
    const fragment = await encodeInvoiceLink(document);
    expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeInvoiceLink(fragment)).toEqual(document);
    expect(await decodeInvoiceLink('not-a-link!!')).toBeNull();
  });
});
