import { itemStatus, stockValue, type LowStockRule } from '../domain/stock';
import type { Ledger } from './ops';
import { bangkokDay } from './relativize';
import type { ItemView } from '../domain/read-models';
import { countViews, itemViews, reorderGroups } from './views';

// The owner dashboard (02 §3.1 item 8), computed from the ledger: the numbers the server dashboard used to compute (retired in S11).
// Stock value over 30 days is rebuilt from the movements: a day's closing stock is today's on hand minus everything
// recorded after that day, valued at the current cost. Top outflow is ranked by value at cost.

const DAY_MS = 86_400_000;

/** Midnight (Bangkok) of the day `value` falls on. */
export function bangkokMidnight(value: Date): Date {
  return new Date(`${bangkokDay(value)}T00:00:00+07:00`);
}

export type DashboardView = ReturnType<typeof dashboardView>;

export function dashboardView(
  ledger: Ledger,
  rule: LowStockRule,
  now: Date = new Date(),
) {
  const items: ItemView[] = itemViews(ledger, 'owner');
  const byId = new Map(items.map((item) => [item.id, item]));
  const today = bangkokMidnight(now);
  const since = new Date(today.getTime() - 29 * DAY_MS);
  const monthStart = new Date(
    `${bangkokDay(now).slice(0, 7)}-01T00:00:00+07:00`,
  );

  const movements = ledger.movements.map((movement) => ({
    itemId: movement.itemId,
    type: movement.type,
    reason: movement.reason,
    quantityBase: movement.quantityBase,
    occurredAt: new Date(movement.occurredAt),
  }));

  const statusOf = (item: ItemView) =>
    itemStatus(item.onHand, item.minQty, rule);
  const low = items.filter((item) => statusOf(item) === 'low').length;
  const out = items.filter((item) => statusOf(item) === 'out').length;
  const value = items.reduce(
    (sum, item) => sum + stockValue(item.onHand, item.costSatang ?? null),
    0,
  );
  const approved = countViews(ledger).filter(
    (count) => count.status === 'approved',
  );
  const lastCountAt = approved.reduce<Date | null>((latest, count) => {
    const at = count.approvedAt;
    return at && (!latest || at > latest) ? at : latest;
  }, null);

  // Closing value for each of the last 30 days, oldest first; the last point is now.
  const onHand = new Map(items.map((item) => [item.id, item.onHand]));
  const sorted = [...movements].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
  );
  const series: { date: Date; value: number }[] = [];
  let cursor = 0;
  for (let day = 0; day < 30; day += 1) {
    const end = new Date(today.getTime() - (day - 1) * DAY_MS);
    while (cursor < sorted.length && sorted[cursor]!.occurredAt >= end) {
      const movement = sorted[cursor]!;
      onHand.set(
        movement.itemId,
        (onHand.get(movement.itemId) ?? 0) - movement.quantityBase,
      );
      cursor += 1;
    }
    let total = 0;
    for (const [itemId, quantity] of onHand)
      total += stockValue(quantity, byId.get(itemId)?.costSatang ?? null);
    series.push({
      date: new Date(today.getTime() - day * DAY_MS),
      value: total,
    });
  }
  series.reverse();

  const outflow = new Map<string, number>();
  for (const movement of movements) {
    if (movement.type !== 'out' || movement.occurredAt < since) continue;
    outflow.set(
      movement.itemId,
      (outflow.get(movement.itemId) ?? 0) - movement.quantityBase,
    );
  }
  const topOutflow = [...outflow.entries()]
    .flatMap(([itemId, quantity]) => {
      const item = byId.get(itemId);
      return item
        ? [{ item, quantity, value: quantity * (item.costSatang ?? 0) }]
        : [];
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const shrinkageRows = movements.filter(
    (movement) =>
      movement.reason === 'count' &&
      movement.quantityBase < 0 &&
      movement.occurredAt >= monthStart,
  );
  const shrinkage = {
    value: shrinkageRows.reduce(
      (sum, movement) =>
        sum -
        movement.quantityBase * (byId.get(movement.itemId)?.costSatang ?? 0),
      0,
    ),
    items: new Set(shrinkageRows.map((movement) => movement.itemId)).size,
  };

  return {
    kpis: {
      low,
      out,
      value,
      movementsToday: movements.filter(
        (movement) => movement.occurredAt >= today,
      ).length,
      lastCountAt,
    },
    series,
    topOutflow,
    shrinkage,
    toOrder: reorderGroups(ledger, 'owner').flatMap((group) =>
      group.lines.map((line) => ({
        ...line,
        supplierName: group.supplier?.name ?? null,
      })),
    ),
  };
}
