import type { MovementView } from '../domain/read-models';
import type { MovementType, Role } from '../domain/stock';
import type { Ledger } from './ops';
import { bangkokDay } from './relativize';
import { movementViews } from './views';

// The history screen's rows and filters (02 §8 screen 6). Filters come from the URL: item, from, to (Bangkok days,
// inclusive), type and user. Rows are newest first; `limit` grows with the "load more" pages.

export type HistoryFilters = {
  itemId?: string;
  /** Bangkok calendar day, YYYY-MM-DD, inclusive. */
  from?: string;
  to?: string;
  type?: MovementType;
  userId?: string;
};

export function historyRows(
  ledger: Ledger,
  role: Role,
  filters: HistoryFilters,
  { limit = Number.POSITIVE_INFINITY }: { limit?: number } = {},
): { rows: MovementView[]; total: number } {
  const byUser = filters.userId
    ? new Set(
        ledger.movements
          .filter((movement) => movement.userId === filters.userId)
          .map((movement) => movement.id),
      )
    : null;
  const matching = movementViews(ledger, role).filter((row) => {
    if (filters.itemId && row.item.id !== filters.itemId) return false;
    if (filters.type && row.type !== filters.type) return false;
    if (byUser && !byUser.has(row.id)) return false;
    const day = bangkokDay(row.occurredAt);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return true;
  });
  return { rows: matching.slice(0, limit), total: matching.length };
}
