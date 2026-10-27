import { needsReorder, suggestReorderQty, type LowStockRule } from './stock';

export type ReorderCandidate = {
  itemId: string;
  supplierId: string | null;
  onHand: number;
  minQty: number;
  reorderQty: number;
  /** Largest pack factor of the item (1 when it has no packs). */
  packFactor: number;
  /** Base units already on open purchase orders. */
  onOrder: number;
};

export type ReorderLine<T extends ReorderCandidate> = T & {
  suggested: number;
};

export type ReorderGroup<T extends ReorderCandidate> = {
  supplierId: string | null;
  lines: ReorderLine<T>[];
};

/**
 * This week's reorder list (02 §3.1 item 4): items at or under min, grouped by preferred supplier (items without
 * one last), each with the suggested quantity. Items already on order stay listed so the owner sees them, but
 * the page leaves them unticked.
 */
export function buildReorderList<T extends ReorderCandidate>(
  items: T[],
  rule: LowStockRule = 'at_or_below_min',
): ReorderGroup<T>[] {
  const groups = new Map<string | null, ReorderLine<T>[]>();
  for (const item of items) {
    if (!needsReorder(item.onHand, item.minQty, rule)) continue;
    const line = { ...item, suggested: suggestReorderQty(item) };
    groups.set(item.supplierId, [...(groups.get(item.supplierId) ?? []), line]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : 0))
    .map(([supplierId, lines]) => ({ supplierId, lines }));
}
