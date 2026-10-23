export type MeterKind = 'electricity' | 'water';

/** One reading waiting to reach the server (01 §6.4). `error` is set when the server refused it. */
export type QueuedReading = {
  key: string;
  roomId: string;
  kind: MeterKind;
  period: string;
  reading: number;
  rollover: boolean;
  /** ISO time the caretaker entered it, so a late sync keeps the original time. */
  readAt: string;
  error: string | null;
};

export type QueueEntry = Omit<QueuedReading, 'key' | 'error'>;

/** One queued reading per room, meter and period: the latest value the caretaker typed. */
export function queueKey(roomId: string, kind: MeterKind, period: string): string {
  return `${roomId}|${kind}|${period}`;
}

/** Adds or replaces the entry for its key. A replaced entry loses its earlier server error. */
export function mergeQueue(queue: QueuedReading[], entry: QueueEntry): QueuedReading[] {
  const key = queueKey(entry.roomId, entry.kind, entry.period);
  return [...queue.filter((item) => item.key !== key), { ...entry, key, error: null }];
}

/** Items still to send: not yet refused by the server. */
export function pendingItems(queue: QueuedReading[]): QueuedReading[] {
  return queue.filter((item) => item.error === null);
}

/** Items the server refused; the caretaker has to look at these. */
export function refusedItems(queue: QueuedReading[]): QueuedReading[] {
  return queue.filter((item) => item.error !== null);
}
