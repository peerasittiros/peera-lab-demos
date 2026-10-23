import { ActionError, withTenant, type Tx } from '@peera/db';
import { eq } from 'drizzle-orm';
import { canMove, type RepairStatus } from '../../domain/repair';
import { repairTicket, ticketMessage } from '../schema';
import { recordEvent } from './tenant';

export type TicketUpdate = {
  ticketId: string;
  status?: RepairStatus;
  assignee?: string | null;
  scheduledAt?: Date | null;
  costSatang?: number | null;
  billToRenter?: boolean;
};

/**
 * Moves a ticket and sets its assignee, schedule, cost and billing choice (01 §3.1 E.17). Closing a ticket sets
 * `closed_at`. A cost billed to the renter needs a cost above zero; the charge goes on the next billing run
 * (`loadBillingPlan`). Every change records `repair.updated`, so the tenant's timeline moves live.
 */
export async function updateTicket(tx: Tx, tenantId: string, input: TicketUpdate) {
  const scope = withTenant(tx, tenantId);
  const [found] = await scope.select(repairTicket, eq(repairTicket.id, input.ticketId));
  if (!found) throw new ActionError('repair.not_found', 'repairs.errors.notFound');
  const status = input.status ?? (found.status as RepairStatus);
  if (input.status && input.status !== found.status && !canMove(found.status as RepairStatus, input.status)) {
    throw new ActionError('repair.closed', 'repairs.errors.closed');
  }
  const cost = input.costSatang !== undefined ? input.costSatang : found.costSatang;
  const bill = input.billToRenter !== undefined ? input.billToRenter : found.billToRenter;
  if (bill && (cost ?? 0) <= 0) throw new ActionError('repair.bill_needs_cost', 'repairs.errors.billNeedsCost');

  await scope.update(
    repairTicket,
    {
      status,
      assignee: input.assignee !== undefined ? input.assignee : found.assignee,
      scheduledAt: input.scheduledAt !== undefined ? input.scheduledAt : found.scheduledAt,
      costSatang: cost,
      billToRenter: bill,
      closedAt: status === 'done' || status === 'cancelled' ? (found.closedAt ?? new Date()) : null,
    },
    eq(repairTicket.id, input.ticketId),
  );
  await recordEvent(tx, tenantId, 'repair.updated', { ticketId: input.ticketId, status });
  return { ticketId: input.ticketId, status };
}

/** A note from the owner to the tenant, shown on the ticket's timeline. */
export async function addOwnerNote(tx: Tx, tenantId: string, input: { ticketId: string; body: string }) {
  const scope = withTenant(tx, tenantId);
  const [found] = await scope.select(repairTicket, eq(repairTicket.id, input.ticketId));
  if (!found) throw new ActionError('repair.not_found', 'repairs.errors.notFound');
  await scope.insert(ticketMessage, [{ ticketId: input.ticketId, authorRole: 'owner', body: input.body }]);
  await recordEvent(tx, tenantId, 'repair.updated', { ticketId: input.ticketId, note: true });
  return { ticketId: input.ticketId };
}
