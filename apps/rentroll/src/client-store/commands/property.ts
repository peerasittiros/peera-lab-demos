import { z } from 'zod';
import { bangkokDate } from '@/src/domain/dates';
import { daysLate } from '@/src/domain/late-fee';
import { ratePlanOn } from '@/src/domain/property';
import { canMove, type RepairStatus } from '@/src/domain/repair';
import { newId } from '../ids';
import { balanceOf } from '../settlement';
import { liveContractOf } from '../selectors/property';
import type { CommandContext, CommandResult } from './payments';

/**
 * Commands for the property and tenant-service screens (SPEC §4 O2–O5, O15, O16): room maintenance, giving notice,
 * announcements, repair tickets and their messages, and the reminders for overdue invoices.
 */

const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});
const isOwner = (ctx: CommandContext) => ctx.role === 'owner';
const CAN_HANDLE_REPAIRS = ['owner', 'caretaker'] as const;

export function actSetMaintenance(
  ctx: CommandContext,
  input: { roomId: string; maintenance: boolean },
): CommandResult<{ roomId: string }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  if (!ctx.store.getState().data.room.some((r) => r.id === input.roomId))
    return fail('property.errors.notFound');
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'room.maintenance',
    payload: { roomId: input.roomId, maintenance: input.maintenance },
  });
  return ok
    ? { ok: true, value: { roomId: input.roomId } }
    : fail('property.errors.saveFailed');
}

export function actGiveNotice(
  ctx: CommandContext,
  input: { contractId: string; noticeDate: string },
): CommandResult<{ contractId: string }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  if (!z.iso.date().safeParse(input.noticeDate).success)
    return fail('property.errors.invalid');
  const contract = ctx.store
    .getState()
    .data.contract.find((c) => c.id === input.contractId);
  if (!contract) return fail('contracts.errors.notFound');
  if (contract.status !== 'active') return fail('contracts.errors.notActive');
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'contract.notice',
    payload: { contractId: input.contractId, noticeDate: input.noticeDate },
  });
  return ok
    ? { ok: true, value: { contractId: input.contractId } }
    : fail('contracts.errors.saveFailed');
}

const announcementInput = z.object({
  buildingId: z.uuid(),
  titleTh: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().min(1).max(120),
  bodyTh: z.string().trim().min(1).max(2000),
  bodyEn: z.string().trim().min(1).max(2000),
});

export function actPostAnnouncement(
  ctx: CommandContext,
  input: z.input<typeof announcementInput>,
): CommandResult<{ announcementId: string }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const parsed = announcementInput.safeParse(input);
  if (!parsed.success) return fail('property.errors.invalid');
  const announcementId = newId();
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'announcement.post',
    payload: {
      announcementId,
      ...parsed.data,
      publishedAt: ctx.now().toISOString(),
    },
  });
  return ok
    ? { ok: true, value: { announcementId } }
    : fail('property.errors.saveFailed');
}

const repairInput = z.object({
  roomId: z.uuid(),
  category: z.enum([
    'electrical',
    'plumbing',
    'aircon',
    'furniture',
    'internet',
    'other',
  ]),
  description: z.string().trim().min(1).max(2000),
  preferredTime: z.enum(['morning', 'afternoon', 'evening', 'anytime']),
  allowEntry: z.boolean(),
});

/** A repair request. The tenant's renter is the primary renter of the room's live contract, when there is one. */
export function actCreateRepair(
  ctx: CommandContext,
  input: z.input<typeof repairInput>,
): CommandResult<{ ticketId: string }> {
  const parsed = repairInput.safeParse(input);
  if (!parsed.success) return fail('ownerRepairs.errors.saveFailed');
  const data = ctx.store.getState().data;
  const room = data.room.find((r) => r.id === parsed.data.roomId);
  if (!room) return fail('property.errors.notFound');
  const today = bangkokDate(ctx.now());
  const contract = liveContractOf(data, room.id, today);
  const link =
    contract &&
    data.contract_renter.find(
      (cr) => cr.contractId === contract.id && cr.isPrimary,
    );
  const ticketId = newId();
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'repair.create',
    payload: {
      ticketId,
      roomId: room.id,
      roomNumber: room.number,
      renterId: link ? link.renterId : null,
      category: parsed.data.category,
      description: parsed.data.description,
      preferredTime: parsed.data.preferredTime,
      allowEntry: parsed.data.allowEntry,
      messageId: newId(),
    },
  });
  return ok
    ? { ok: true, value: { ticketId } }
    : fail('ownerRepairs.errors.saveFailed');
}

/** Moves a ticket to another status. A closed ticket does not move again. */
export function actMoveRepair(
  ctx: CommandContext,
  input: { ticketId: string; status: RepairStatus },
): CommandResult<{ status: RepairStatus }> {
  if (
    !CAN_HANDLE_REPAIRS.includes(
      ctx.role as (typeof CAN_HANDLE_REPAIRS)[number],
    )
  )
    return fail('errors.forbidden');
  const ticket = ctx.store
    .getState()
    .data.repair_ticket.find((t) => t.id === input.ticketId);
  if (!ticket) return fail('ownerRepairs.errors.notFound');
  if (!canMove(ticket.status as RepairStatus, input.status))
    return fail('ownerRepairs.errors.closed');
  const closed = input.status === 'done' || input.status === 'cancelled';
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'repair.update',
    payload: {
      ticketId: ticket.id,
      status: input.status,
      assignee: ticket.assignee,
      scheduledAt: ticket.scheduledAt,
      costSatang: ticket.costSatang,
      billToRenter: ticket.billToRenter,
      closedAt: closed ? (ticket.closedAt ?? ctx.now().toISOString()) : null,
    },
  });
  return ok
    ? { ok: true, value: { status: input.status } }
    : fail('ownerRepairs.errors.saveFailed');
}

/** Sets the assignee, schedule, cost and billing choice. Billing the tenant needs a cost above zero. */
export function actUpdateRepair(
  ctx: CommandContext,
  input: {
    ticketId: string;
    assignee: string | null;
    scheduledAt: string | null;
    costSatang: number | null;
    billToRenter: boolean;
  },
): CommandResult<{ ticketId: string }> {
  if (
    !CAN_HANDLE_REPAIRS.includes(
      ctx.role as (typeof CAN_HANDLE_REPAIRS)[number],
    )
  )
    return fail('errors.forbidden');
  const ticket = ctx.store
    .getState()
    .data.repair_ticket.find((t) => t.id === input.ticketId);
  if (!ticket) return fail('ownerRepairs.errors.notFound');
  if (input.billToRenter && (input.costSatang ?? 0) <= 0)
    return fail('ownerRepairs.errors.billNeedsCost');
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'repair.update',
    payload: {
      ticketId: ticket.id,
      status: ticket.status,
      assignee: input.assignee,
      scheduledAt: input.scheduledAt,
      costSatang: input.costSatang,
      billToRenter: input.billToRenter,
      closedAt: ticket.closedAt,
    },
  });
  return ok
    ? { ok: true, value: { ticketId: ticket.id } }
    : fail('ownerRepairs.errors.saveFailed');
}

/** A message on a ticket's timeline, from the owner, the caretaker or the tenant. */
export function actAddRepairNote(
  ctx: CommandContext,
  input: { ticketId: string; body: string },
): CommandResult<{ messageId: string }> {
  const body = input.body.trim();
  if (body === '' || body.length > 2000)
    return fail('ownerRepairs.errors.saveFailed');
  if (
    !ctx.store
      .getState()
      .data.repair_ticket.some((t) => t.id === input.ticketId)
  ) {
    return fail('ownerRepairs.errors.notFound');
  }
  const messageId = newId();
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'repair.note',
    payload: {
      messageId,
      ticketId: input.ticketId,
      authorRole: ctx.role,
      body,
    },
  });
  return ok
    ? { ok: true, value: { messageId } }
    : fail('ownerRepairs.errors.saveFailed');
}

/** A reminder about an overdue invoice. Nothing is sent: it is recorded in the chat preview only. */
export function actSendReminder(
  ctx: CommandContext,
  input: { invoiceId: string },
): CommandResult<{ daysOverdue: number }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const data = ctx.store.getState().data;
  const invoice = data.invoice.find((i) => i.id === input.invoiceId);
  const today = bangkokDate(ctx.now());
  if (
    !invoice ||
    !['sent', 'partially_paid'].includes(invoice.status) ||
    invoice.dueDate >= today
  ) {
    return fail('payments.errors.notOverdue');
  }
  const days = daysLate(invoice.dueDate, ctx.now());
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'message.mock',
    payload: {
      messageId: newId(),
      invoiceId: invoice.id,
      daysOverdue: days,
      outstandingSatang: balanceOf(data, invoice),
      dueDate: invoice.dueDate,
    },
  });
  return ok
    ? { ok: true, value: { daysOverdue: days } }
    : fail('payments.errors.saveFailed');
}

const buildingInput = z.object({
  buildingId: z.uuid(),
  nameTh: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().max(120).nullable(),
  promptpayId: z.string().trim().min(1).max(40),
  billingDay: z.number().int().min(1).max(28),
  dueDay: z.number().int().min(1).max(28),
});

/** Edits a building's names, PromptPay ID and billing days (SPEC §4 O5). Owner only. */
export function actUpdateBuilding(
  ctx: CommandContext,
  input: z.input<typeof buildingInput>,
): CommandResult<{ buildingId: string }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const parsed = buildingInput.safeParse(input);
  if (!parsed.success) return fail('property.errors.invalid');
  if (
    !ctx.store
      .getState()
      .data.building.some((b) => b.id === parsed.data.buildingId)
  )
    return fail('property.errors.notFound');
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'building.update',
    payload: parsed.data,
  });
  return ok
    ? { ok: true, value: { buildingId: parsed.data.buildingId } }
    : fail('property.errors.saveFailed');
}

const ratePlanInput = z.object({
  buildingId: z.uuid(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  elecRateSatang: z.number().int().min(0),
  elecMinSatang: z.number().int().min(0),
  waterMode: z.enum(['per_unit', 'per_person']),
  waterRateSatang: z.number().int().min(0),
  waterMinSatang: z.number().int().min(0),
  waterPerPersonSatang: z.number().int().min(0),
  commonFeeSatang: z.number().int().min(0),
});

/**
 * Adds a rate plan that starts on `validFrom` (SPEC §4 O5). It can't start before today, and two plans in a building
 * can't start the same day. Bills generated earlier keep the plan they were generated with.
 */
export function actAddRatePlan(
  ctx: CommandContext,
  input: z.input<typeof ratePlanInput>,
): CommandResult<{ planId: string }> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const parsed = ratePlanInput.safeParse(input);
  if (!parsed.success) return fail('property.errors.invalid');
  const data = ctx.store.getState().data;
  const today = bangkokDate(ctx.now());
  if (!data.building.some((b) => b.id === parsed.data.buildingId))
    return fail('property.errors.notFound');
  if (parsed.data.validFrom < today) return fail('property.errors.pastDate');
  const plans = data.rate_plan.filter(
    (p) => p.buildingId === parsed.data.buildingId,
  );
  if (plans.some((p) => p.validFrom === parsed.data.validFrom))
    return fail('property.errors.ratePlanDuplicate');
  // The late-fee rule carries over from the plan in force today, so a rate change never changes how late fees work.
  const current = ratePlanOn(plans, today);
  const lateFeeRule = current?.lateFeeRule ?? {
    kind: 'per_day' as const,
    amountSatang: 0,
    capSatang: 0,
  };
  const planId = newId();
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'rate_plan.add',
    payload: {
      ...parsed.data,
      id: planId,
      lateFeeRule,
    },
  });
  return ok
    ? { ok: true, value: { planId } }
    : fail('property.errors.saveFailed');
}
