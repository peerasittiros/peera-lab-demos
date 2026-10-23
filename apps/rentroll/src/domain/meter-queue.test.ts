import { describe, expect, it } from 'vitest';
import { mergeQueue, pendingItems, queueKey, refusedItems, type QueuedReading } from './meter-queue';

const entry = (reading: number, extra: Partial<QueuedReading> = {}) => ({
  roomId: 'r1',
  kind: 'electricity' as const,
  period: '2026-10',
  reading,
  rollover: false,
  readAt: '2026-10-23T09:00:00.000Z',
  ...extra,
});

describe('mergeQueue', () => {
  it('keeps one entry per room, meter and period, with the latest value', () => {
    let queue: QueuedReading[] = [];
    queue = mergeQueue(queue, entry(100));
    queue = mergeQueue(queue, entry(105));
    expect(queue).toHaveLength(1);
    expect(queue[0]!.reading).toBe(105);
    expect(queue[0]!.key).toBe(queueKey('r1', 'electricity', '2026-10'));
  });

  it('keeps other rooms, meters and periods', () => {
    let queue: QueuedReading[] = [];
    queue = mergeQueue(queue, entry(100));
    queue = mergeQueue(queue, entry(20, { kind: 'water' }));
    queue = mergeQueue(queue, entry(101, { roomId: 'r2' }));
    queue = mergeQueue(queue, entry(102, { period: '2026-09' }));
    expect(queue).toHaveLength(4);
  });

  it('clears an earlier server refusal when the caretaker corrects the value', () => {
    const refused = [{ ...mergeQueue([], entry(90))[0]!, error: 'meter.lower_needs_rollover' }];
    const fixed = mergeQueue(refused, entry(120));
    expect(fixed[0]!.error).toBeNull();
    expect(pendingItems(fixed)).toHaveLength(1);
  });
});

describe('pendingItems and refusedItems', () => {
  it('split the queue by whether the server refused the item', () => {
    const queue: QueuedReading[] = [
      { ...mergeQueue([], entry(1))[0]!, key: 'a', error: null },
      { ...mergeQueue([], entry(2, { roomId: 'r2' }))[0]!, key: 'b', error: 'meter.lower_needs_rollover' },
    ];
    expect(pendingItems(queue).map((i) => i.key)).toEqual(['a']);
    expect(refusedItems(queue).map((i) => i.key)).toEqual(['b']);
  });
});
