import { z } from 'zod';
import { newId } from '../ids';
import type { Op, SlipKind } from '../ops';
import type { Role } from '../schema';
import type { Store } from '../store';
import { allocationFor, owedOn, receiptFor } from '../settlement';

/**
 * Commands for the payment flow (mirrors `src/actions/payments.ts`). Each one checks the role and its input, works out
 * the results from the current data, and dispatches one op. Errors are message keys, the same ones the server uses.
 */

export type CommandResult<T> =
  { ok: true; value: T } | { ok: false; error: string };

export type CommandContext = {
  store: Store;
  role: Role;
  /** The moment of the command; ops are stamped with it. */
  now: () => Date;
};

const PAYER_ROLES: readonly Role[] = ['owner', 'tenant'];
const OWNER_ROLES: readonly Role[] = ['owner'];

const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});

const OPEN_STATUSES = ['sent', 'partially_paid'];

const slipInput = z.object({
  invoiceId: z.uuid(),
  amountSatang: z.number().int().min(1),
  slipUrl: z.enum(['sample', 'uploaded']).nullable(),
});
const decisionInput = z.object({ paymentId: z.uuid() });
const approveInput = decisionInput.extend({
  amountSatang: z.number().int().min(1).optional(),
});
const rejectInput = decisionInput.extend({
  reason: z.string().trim().min(1).max(200),
});
const manualInput = z.object({
  contractId: z.uuid(),
  amountSatang: z.number().int().min(1),
  method: z.enum(['cash', 'transfer']),
});

function stamp<K extends Op['kind']>(
  ctx: CommandContext,
  kind: K,
  payload: Extract<Op, { kind: K }>['payload'],
): Extract<Op, { kind: K }> {
  return {
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind,
    payload,
  } as Extract<Op, { kind: K }>;
}

/** The tenant's slip: recorded for the owner's review. Nothing moves on the invoice until it is approved. */
export function actSubmitSlip(
  ctx: CommandContext,
  input: { invoiceId: string; amountSatang: number; slipUrl: SlipKind },
): CommandResult<{ paymentId: string }> {
  if (!PAYER_ROLES.includes(ctx.role)) return fail('errors.forbidden');
  const parsed = slipInput.safeParse(input);
  if (!parsed.success) return fail('payments.errors.invalidAmount');

  const data = ctx.store.getState().data;
  const target = data.invoice.find((i) => i.id === parsed.data.invoiceId);
  if (!target || !OPEN_STATUSES.includes(target.status))
    return fail('payments.errors.notPayable');
  if (parsed.data.amountSatang > owedOn(data, target.contractId))
    return fail('payments.errors.exceedsBalance');

  const paymentId = newId();
  const op = stamp(ctx, 'slip.submit', {
    paymentId,
    contractId: target.contractId,
    amountSatang: parsed.data.amountSatang,
    slipUrl: parsed.data.slipUrl,
    paidAt: ctx.now().toISOString(),
  });
  return ctx.store.dispatch(op)
    ? { ok: true, value: { paymentId } }
    : fail('payments.errors.notFound');
}

/** Approves a pending slip for `amount` (defaults to the slip amount) and issues the receipt. */
export function actApprovePayment(
  ctx: CommandContext,
  input: { paymentId: string; amountSatang?: number },
): CommandResult<{
  receiptNumber: string;
  allocations: { invoiceId: string; amount: number }[];
}> {
  if (!OWNER_ROLES.includes(ctx.role)) return fail('errors.forbidden');
  const parsed = approveInput.safeParse(input);
  if (!parsed.success) return fail('payments.errors.invalidAmount');

  const data = ctx.store.getState().data;
  const payment = data.payment.find((p) => p.id === parsed.data.paymentId);
  if (!payment) return fail('payments.errors.notFound');
  if (payment.status !== 'pending_review')
    return fail('payments.errors.notPending');
  const amount = parsed.data.amountSatang ?? payment.amountSatang;
  if (amount <= 0 || amount > payment.amountSatang)
    return fail('payments.errors.invalidAmount');

  const allocations = allocationFor(data, payment.contractId, amount);
  if (!allocations) return fail('payments.errors.exceedsBalance');
  const receipt = receiptFor(data, payment.contractId, ctx.now());
  if (!receipt) return fail('payments.errors.notFound');

  const op = stamp(ctx, 'payment.approve', {
    paymentId: payment.id,
    amountSatang: amount,
    reviewedBy: 'owner',
    ...receipt,
    allocations,
  });
  if (!ctx.store.dispatch(op)) return fail('payments.errors.notFound');
  return {
    ok: true,
    value: { receiptNumber: receipt.receiptNumber, allocations },
  };
}

/** Cash or transfer the owner records: approved at once and settled the same way as a slip. */
export function actRecordManualPayment(
  ctx: CommandContext,
  input: {
    contractId: string;
    amountSatang: number;
    method: 'cash' | 'transfer';
  },
): CommandResult<{
  paymentId: string;
  receiptNumber: string;
}> {
  if (!OWNER_ROLES.includes(ctx.role)) return fail('errors.forbidden');
  const parsed = manualInput.safeParse(input);
  if (!parsed.success) return fail('payments.errors.invalidAmount');

  const data = ctx.store.getState().data;
  if (!data.contract.some((c) => c.id === parsed.data.contractId))
    return fail('payments.errors.notFound');
  const allocations = allocationFor(
    data,
    parsed.data.contractId,
    parsed.data.amountSatang,
  );
  if (!allocations) return fail('payments.errors.exceedsBalance');
  const receipt = receiptFor(data, parsed.data.contractId, ctx.now());
  if (!receipt) return fail('payments.errors.notFound');

  const paymentId = newId();
  const op = stamp(ctx, 'payment.record', {
    paymentId,
    contractId: parsed.data.contractId,
    amountSatang: parsed.data.amountSatang,
    method: parsed.data.method,
    paidAt: ctx.now().toISOString(),
    reviewedBy: 'owner',
    ...receipt,
    allocations,
  });
  if (!ctx.store.dispatch(op)) return fail('payments.errors.notFound');
  return {
    ok: true,
    value: { paymentId, receiptNumber: receipt.receiptNumber },
  };
}

export function actRejectPayment(
  ctx: CommandContext,
  input: { paymentId: string; reason: string },
): CommandResult<{ paymentId: string }> {
  if (!OWNER_ROLES.includes(ctx.role)) return fail('errors.forbidden');
  const parsed = rejectInput.safeParse(input);
  if (!parsed.success) return fail('payments.errors.notFound');

  const payment = ctx.store
    .getState()
    .data.payment.find((p) => p.id === parsed.data.paymentId);
  if (!payment) return fail('payments.errors.notFound');
  if (payment.status !== 'pending_review')
    return fail('payments.errors.notPending');

  const op = stamp(ctx, 'payment.reject', {
    paymentId: payment.id,
    reason: parsed.data.reason,
    reviewedBy: 'owner',
  });
  return ctx.store.dispatch(op)
    ? { ok: true, value: { paymentId: payment.id } }
    : fail('payments.errors.notFound');
}
