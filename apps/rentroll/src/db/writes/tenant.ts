import { ActionError, event, withTenant, type Tx } from '@peera/db';
import { eq } from 'drizzle-orm';
import { PREFERRED_TIMES, REPAIR_CATEGORIES } from '../../domain/repair';
import { announcement, repairTicket, room, ticketMessage } from '../schema';

/** Events the DemoSplit's owner side listens for (01 §6.1). Payloads carry ids and labels only. */
export async function recordEvent(tx: Tx, tenantId: string, kind: string, payload: Record<string, unknown>) {
  await withTenant(tx, tenantId).insert(event, [{ kind, payload }]);
}


/** A repair request from the tenant (01 §3.1 D.15). Starts as `new` on the owner's board. */
export async function createRepairTicket(
  tx: Tx,
  tenantId: string,
  input: {
    roomId: string;
    renterId: string | null;
    category: (typeof REPAIR_CATEGORIES)[number];
    description: string;
    preferredTime: (typeof PREFERRED_TIMES)[number];
    allowEntry: boolean;
  },
) {
  const scope = withTenant(tx, tenantId);
  const [roomRow] = await scope.select(room, eq(room.id, input.roomId));
  if (!roomRow) throw new ActionError('room.not_found', 'property.errors.notFound');
  const [created] = await scope
    .insert(repairTicket, [
      {
        roomId: input.roomId,
        renterId: input.renterId,
        category: input.category,
        description: input.description,
        preferredTime: input.preferredTime,
        allowEntry: input.allowEntry,
        status: 'new',
      },
    ])
    .returning({ id: repairTicket.id });
  await scope.insert(ticketMessage, [{ ticketId: created!.id, authorRole: 'tenant', body: input.description }]);
  await recordEvent(tx, tenantId, 'repair.created', { ticketId: created!.id, roomNumber: roomRow.number, category: input.category });
  return { ticketId: created!.id };
}

/** An announcement for the building, shown on the tenant home and the owner's list. */
export async function postAnnouncement(
  tx: Tx,
  tenantId: string,
  input: { buildingId: string; titleTh: string; titleEn: string; bodyTh: string; bodyEn: string; publishedAt: Date },
) {
  const scope = withTenant(tx, tenantId);
  const [created] = await scope
    .insert(announcement, [{ ...input, buildingId: input.buildingId }])
    .returning({ id: announcement.id });
  await recordEvent(tx, tenantId, 'announcement.posted', { announcementId: created!.id });
  return { announcementId: created!.id };
}
