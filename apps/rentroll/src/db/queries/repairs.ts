import { withTenant, type Queryable } from '@peera/db';
import { repairTicket, room, ticketMessage } from '../schema';

export type BoardTicket = {
  id: string;
  roomNumber: string;
  category: string;
  description: string;
  status: string;
  assignee: string | null;
  scheduledAt: string | null;
  costSatang: number | null;
  billToRenter: boolean;
  createdAt: string;
  messages: { id: string; authorRole: string; body: string; at: string }[];
};

/** Every repair ticket of the tenant, newest first, with its room and its messages (01 §3.1 E.17). */
export async function loadRepairBoard(db: Queryable, tenantId: string): Promise<BoardTicket[]> {
  const scope = withTenant(db, tenantId);
  const [tickets, rooms, messages] = await Promise.all([
    scope.select(repairTicket),
    scope.select(room),
    scope.select(ticketMessage),
  ]);
  const roomNumber = new Map(rooms.map((r) => [r.id, r.number]));
  return tickets
    .map((t) => ({
      id: t.id,
      roomNumber: roomNumber.get(t.roomId) ?? '',
      category: t.category,
      description: t.description,
      status: t.status,
      assignee: t.assignee,
      scheduledAt: t.scheduledAt ? t.scheduledAt.toISOString() : null,
      costSatang: t.costSatang,
      billToRenter: t.billToRenter,
      createdAt: t.createdAt.toISOString(),
      messages: messages
        .filter((m) => m.ticketId === t.id)
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map((m) => ({ id: m.id, authorRole: m.authorRole, body: m.body, at: m.at.toISOString() })),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
