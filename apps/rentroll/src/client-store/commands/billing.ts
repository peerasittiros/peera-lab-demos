import { z } from 'zod';
import { addMonths, bangkokDate } from '@/src/domain/dates';
import { formatDocumentNumber, type YearStyle } from '@/src/domain/numbering';
import { invoiceTotals, type InvoiceLineKind } from '@/src/domain/invoice';
import { labelOf, missingReadings, planRoom } from '@/src/domain/billing-run';
import { newId } from '../ids';
import { billingPlan, nextSequence } from '../selectors/billing';
import type { LineRecord } from '../ops';
import type { CommandContext, CommandResult } from './payments';

/**
 * Billing run commands (SPEC §4 O10, O11). Generate, adjust a draft's lines, send, and void a draft. The owner does all
 * of these. A sent invoice is never changed; a correction is a credit note, which is not in this round.
 */

const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});
const isOwner = (ctx: CommandContext) => ctx.role === 'owner';

/** Generates the month's drafts for every room without one. Refused while a meter reading is missing and not estimated. */
export function actGenerateBilling(
  ctx: CommandContext,
  input: { buildingId: string; period: string; estimateRoomIds: string[] },
): CommandResult<{ created: number }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const data = ctx.store.getState().data;
  const today = bangkokDate(ctx.now());
  const plan = billingPlan(data, input.buildingId, input.period, today);
  if (!plan) return fail('property.errors.notFound');
  if (!plan.plan) return fail('billing.errors.noRatePlan');

  const estimates = new Set(input.estimateRoomIds);
  const pending = plan.rooms.filter((r) => !r.existingInvoiceId);
  const blocked = pending.some((room) => {
    const missing = missingReadings(room);
    return (
      (missing.electricity || missing.water) && !estimates.has(room.roomId)
    );
  });
  if (blocked) return fail('billing.errors.missingReadings');

  const asOf = ctx.now();
  const year = Number(input.period.slice(0, 4));
  const month = Number(input.period.slice(5, 7));
  const style = plan.building.invoiceYearStyle as YearStyle;
  const issueDate = `${input.period}-${String(plan.building.billingDay).padStart(2, '0')}`;
  const dueDate = `${addMonths(input.period, 1)}-${String(plan.building.dueDay).padStart(2, '0')}`;
  const start = nextSequence(data, plan.building.id, 'INV', year);

  const invoices: {
    id: string;
    contractId: string;
    number: string;
    period: string;
    issueDate: string;
    dueDate: string;
    subtotalSatang: number;
    totalSatang: number;
    publicToken: string;
    lines: LineRecord[];
  }[] = [];
  for (const room of pending) {
    const missing = missingReadings(room);
    const computed = planRoom(
      room,
      plan.plan,
      input.period,
      {
        electricity: missing.electricity && estimates.has(room.roomId),
        water: missing.water && estimates.has(room.roomId),
      },
      asOf,
    );
    if (!computed) continue;
    const sequence = start + invoices.length;
    invoices.push({
      id: newId(),
      contractId: room.contractId,
      number: formatDocumentNumber({
        prefix: 'INV',
        ceYear: year,
        month,
        sequence,
        style,
      }),
      period: input.period,
      issueDate,
      dueDate,
      subtotalSatang: computed.subtotal,
      totalSatang: computed.total,
      publicToken: newId(),
      lines: computed.lines.map((line): LineRecord => {
        const label = labelOf(line);
        return {
          id: newId(),
          kind: line.kind,
          labelTh: label.th,
          labelEn: label.en,
          amountSatang: line.amount,
          meta: line.meta,
        };
      }),
    });
  }
  if (invoices.length === 0) return { ok: true, value: { created: 0 } };

  const dispatched = ctx.store.dispatch({
    id: newId(),
    at: asOf.toISOString(),
    role: ctx.role,
    kind: 'billing.generate',
    payload: {
      buildingId: plan.building.id,
      docType: 'INV',
      year,
      sequence: start,
      invoices,
    },
  });
  return dispatched
    ? { ok: true, value: { created: invoices.length } }
    : fail('billing.errors.saveFailed');
}

const lineInput = z.object({
  id: z.uuid().optional(),
  kind: z.enum([
    'rent',
    'electricity',
    'water',
    'extra',
    'one_off',
    'late_fee',
    'previous_balance',
  ]),
  labelTh: z.string().trim().min(1).max(120),
  labelEn: z.string().trim().min(1).max(120),
  amountSatang: z.number().int().min(0),
  meta: z.record(z.string(), z.unknown()).default({}),
});

/** Replaces the lines of a draft (added, edited or removed). The totals are worked out from the lines. */
export function actAdjustDraftLines(
  ctx: CommandContext,
  input: { invoiceId: string; lines: z.input<typeof lineInput>[] },
): CommandResult<{ totalSatang: number }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const parsed = z.array(lineInput).safeParse(input.lines);
  if (!parsed.success) return fail('billing.errors.saveFailed');
  const data = ctx.store.getState().data;
  const invoice = data.invoice.find((i) => i.id === input.invoiceId);
  if (!invoice) return fail('billing.errors.notFound');
  if (invoice.status !== 'draft') return fail('billing.errors.notDraft');

  const lines: LineRecord[] = parsed.data.map((l) => ({
    id: l.id ?? newId(),
    kind: l.kind,
    labelTh: l.labelTh,
    labelEn: l.labelEn,
    amountSatang: l.amountSatang,
    meta: l.meta,
  }));
  const totals = invoiceTotals(
    lines.map((l) => ({
      kind: l.kind as InvoiceLineKind,
      amount: l.amountSatang,
    })),
  );
  const dispatched = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'invoice.lines',
    payload: {
      invoiceId: invoice.id,
      subtotalSatang: totals.subtotal,
      totalSatang: totals.total,
      lines,
    },
  });
  return dispatched
    ? { ok: true, value: { totalSatang: totals.total } }
    : fail('billing.errors.saveFailed');
}

/** Sends the month's drafts of the building. They are immutable from here on. */
export function actSendBilling(
  ctx: CommandContext,
  input: { buildingId: string; period: string },
): CommandResult<{ sent: number }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const data = ctx.store.getState().data;
  const roomsOfBuilding = new Set(
    data.room.filter((r) => r.buildingId === input.buildingId).map((r) => r.id),
  );
  const invoiceIds = data.invoice
    .filter(
      (i) =>
        i.status === 'draft' &&
        i.period === input.period &&
        i.type === 'monthly' &&
        roomsOfBuilding.has(
          data.contract.find((c) => c.id === i.contractId)?.roomId ?? '',
        ),
    )
    .map((i) => i.id);
  if (invoiceIds.length === 0) return { ok: true, value: { sent: 0 } };
  const sentAt = ctx.now().toISOString();
  const dispatched = ctx.store.dispatch({
    id: newId(),
    at: sentAt,
    role: ctx.role,
    kind: 'billing.send',
    payload: { invoiceIds, sentAt },
  });
  return dispatched
    ? { ok: true, value: { sent: invoiceIds.length } }
    : fail('billing.errors.saveFailed');
}

/** Voids a draft. Its number stays used, so the sequence has no gaps. A sent invoice cannot be voided. */
export function actVoidDraft(
  ctx: CommandContext,
  input: { invoiceId: string },
): CommandResult<{ number: string }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const invoice = ctx.store
    .getState()
    .data.invoice.find((i) => i.id === input.invoiceId);
  if (!invoice) return fail('billing.errors.notFound');
  if (invoice.status !== 'draft') return fail('billing.errors.notDraft');
  const dispatched = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'invoice.void',
    payload: { invoiceId: invoice.id },
  });
  return dispatched
    ? { ok: true, value: { number: invoice.number } }
    : fail('billing.errors.saveFailed');
}
