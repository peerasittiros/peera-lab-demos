/**
 * The order the owner sets in Settings (floors, room types), kept as a comma-separated list of keys in a browser
 * setting. A list can go out of date (a new room type, a floor that gained its first room), so it is always read as
 * guidance: the keys it knows come first in its order, and anything it does not know follows in its natural order.
 */

export type Key = string | number;

/** The stored list, without blanks or repeats. */
export function parseOrder(stored: string | null | undefined): string[] {
  if (!stored) return [];
  const order: string[] = [];
  for (const part of stored.split(',')) {
    const key = part.trim();
    if (key !== '' && !order.includes(key)) order.push(key);
  }
  return order;
}

/** `items` in the stored order, then whatever the store does not mention, in the order given. */
export function byStoredOrder<T>(
  items: T[],
  stored: string[],
  keyOf: (item: T) => Key,
): T[] {
  const place = new Map(stored.map((key, index) => [key, index]));
  return items
    .map((item, index) => ({
      item,
      index,
      place: place.get(String(keyOf(item))),
    }))
    .sort((a, b) => {
      if (a.place !== undefined && b.place !== undefined)
        return a.place - b.place;
      if (a.place !== undefined) return -1;
      if (b.place !== undefined) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/** `keys` with one item moved one place; the same order at either end. */
export function moved<T>(
  keys: T[],
  from: number,
  direction: 'up' | 'down',
): T[] {
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from < 0 || from >= keys.length || to < 0 || to >= keys.length) return keys;
  const next = [...keys];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/** The stored form of an order list. */
export function formatOrder(keys: Key[]): string {
  return keys.map(String).join(',');
}
