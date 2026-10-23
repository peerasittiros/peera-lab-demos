/** Repair request choices, shared by the tenant form and the server (01 §3.1 D.15). Plain values, no server code. */
export const REPAIR_CATEGORIES = ['electrical', 'plumbing', 'aircon', 'furniture', 'internet', 'other'] as const;
export const PREFERRED_TIMES = ['morning', 'afternoon', 'evening', 'anytime'] as const;

export const REPAIR_STATUSES = ['new', 'scheduled', 'in_progress', 'done', 'cancelled'] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

/**
 * Whether a ticket can move from one status to another. A closed ticket (done or cancelled) does not move again,
 * and a move to the same status is not a move.
 */
export function canMove(from: RepairStatus, to: RepairStatus): boolean {
  if (from === to) return false;
  return from !== 'done' && from !== 'cancelled';
}
