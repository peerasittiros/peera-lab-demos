import { bangkokDate } from '@/src/domain/dates';
import { daysLate } from '@/src/domain/late-fee';
import { ratePlanOn } from '@/src/domain/property';
import { canMove, type RepairStatus } from '@/src/domain/repair';
import { newId } from '../ids';
import type { Inputs } from '../schemas';
import { balanceOf } from '../settlement';
import { liveContractOf } from '../selectors/property';
import {
  loadSchemas,
  type CommandContext,
  type CommandResult,
} from './payments';

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

export async function actSetMaintenance(
  ctx: CommandContext,
  input: { roomId: string; maintenance: boolean },
): Promise<CommandResult<{ roomId: string }>> {
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

export async function actGiveNotice(
  ctx: CommandContext,
  input: { contractId: string; noticeDate: string },
): Promise<CommandResult<{ contractId: string }>> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  if (!(await loadSchemas()).dateInput.safeParse(input.noticeDate).success)
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

export async function actPostAnnouncement(
  ctx: CommandContext,
  input: Inputs['announcement'],
): Promise<CommandResult<{ announcementId: string }>> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const parsed = (await loadSchemas()).announcementInput.safeParse(input);
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

/** A repair request. The tenant's renter is the primary renter of the room's live contract, when there is one. */
export async function actCreateRepair(
  ctx: CommandContext,
  input: Inputs['repair'],
): Promise<CommandResult<{ ticketId: string }>> {
  const parsed = (await loadSchemas()).repairInput.safeParse(input);
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
export async function actMoveRepair(
  ctx: CommandContext,
  input: { ticketId: string; status: RepairStatus },
): Promise<CommandResult<{ status: RepairStatus }>> {
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
export async function actUpdateRepair(
  ctx: CommandContext,
  input: {
    ticketId: string;
    assignee: string | null;
    scheduledAt: string | null;
    costSatang: number | null;
    billToRenter: boolean;
  },
): Promise<CommandResult<{ ticketId: string }>> {
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
export async function actAddRepairNote(
  ctx: CommandContext,
  input: { ticketId: string; body: string },
): Promise<CommandResult<{ messageId: string }>> {
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
export async function actSendReminder(
  ctx: CommandContext,
  input: { invoiceId: string },
): Promise<CommandResult<{ daysOverdue: number }>> {
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

/**
 * Edits a building's names, address, PromptPay ID and billing days (SPEC §4 O5). The address is edited on the Building
 * settings page; the billing days on the Billing page, so each form sends only its own fields.
 */
export async function actUpdateBuilding(
  ctx: CommandContext,
  input: Inputs['building'],
): Promise<CommandResult<{ buildingId: string }>> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const parsed = (await loadSchemas()).buildingInput.safeParse(input);
  if (!parsed.success) return fail('property.errors.invalid');
  const building = ctx.store
    .getState()
    .data.building.find((b) => b.id === parsed.data.buildingId);
  if (!building) return fail('property.errors.notFound');
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'building.update',
    payload: {
      ...parsed.data,
      addressTh:
        parsed.data.addressTh === undefined
          ? building.addressTh
          : parsed.data.addressTh,
      addressEn:
        parsed.data.addressEn === undefined
          ? building.addressEn
          : parsed.data.addressEn,
    },
  });
  return ok
    ? { ok: true, value: { buildingId: parsed.data.buildingId } }
    : fail('property.errors.saveFailed');
}

/**
 * Adds a rate plan that starts on `validFrom` (SPEC §4 O5). It can't start before today, and two plans in a building
 * can't start the same day. Bills generated earlier keep the plan they were generated with.
 */
export async function actAddRatePlan(
  ctx: CommandContext,
  input: Inputs['ratePlan'],
): Promise<CommandResult<{ planId: string }>> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const parsed = (await loadSchemas()).ratePlanInput.safeParse(input);
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

/** Edits a room (SPEC §4 O3). A room number is unique within its building, and the type must belong to that building. */
export async function actUpdateRoom(
  ctx: CommandContext,
  input: Inputs['room'],
): Promise<CommandResult<{ roomId: string }>> {
  if (!isOwner(ctx)) return fail('errors.forbidden');
  const parsed = (await loadSchemas()).roomInput.safeParse(input);
  if (!parsed.success) return fail('property.errors.invalid');
  const data = ctx.store.getState().data;
  const room = data.room.find((r) => r.id === parsed.data.roomId);
  if (!room) return fail('property.errors.notFound');
  const type = data.room_type.find((t) => t.id === parsed.data.roomTypeId);
  if (!type || type.buildingId !== room.buildingId)
    return fail('property.errors.invalid');
  if (
    data.room.some(
      (r) =>
        r.id !== room.id &&
        r.buildingId === room.buildingId &&
        r.number === parsed.data.number,
    )
  )
    return fail('property.errors.roomDuplicate');
  const ok = ctx.store.dispatch({
    id: newId(),
    at: ctx.now().toISOString(),
    role: ctx.role,
    kind: 'room.update',
    payload: parsed.data,
  });
  return ok
    ? { ok: true, value: { roomId: room.id } }
    : fail('property.errors.saveFailed');
}
