import type { Data } from '../schema';
import { tenantContract } from './tenant';

/** Selectors for repair tickets (SPEC §4 O15, T5). */

/** Every ticket for the owner's board, newest first, with its room and renter. */
export function repairsBoard(data: Data) {
  return data.repair_ticket
    .map((t) => {
      const room = data.room.find((r) => r.id === t.roomId);
      const renter = t.renterId
        ? data.renter.find((r) => r.id === t.renterId)
        : undefined;
      return {
        id: t.id,
        status: t.status,
        category: t.category,
        description: t.description,
        roomNumber: room?.number ?? '',
        renterName: renter?.name ?? null,
        assignee: t.assignee,
        scheduledAt: t.scheduledAt,
        costSatang: t.costSatang,
        billToRenter: t.billToRenter,
        createdAt: t.createdAt,
        messages: data.ticket_message.filter((m) => m.ticketId === t.id).length,
      };
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** The timeline of one ticket: its messages, oldest first. */
export function ticketThread(data: Data, ticketId: string) {
  return data.ticket_message
    .filter((m) => m.ticketId === ticketId)
    .sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
}

/** The tenant's own tickets, newest first, with the room they are for. */
export function tenantTickets(data: Data, today: string) {
  const current = tenantContract(data, today);
  if (!current) return [];
  return data.repair_ticket
    .filter((t) => t.roomId === current.roomId)
    .map((t) => ({
      id: t.id,
      status: t.status,
      category: t.category,
      description: t.description,
      createdAt: t.createdAt,
      scheduledAt: t.scheduledAt,
      messages: ticketThread(data, t.id),
    }))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}
