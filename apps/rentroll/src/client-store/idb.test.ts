import { describe, expect, it } from 'vitest';
import { openPersistence } from './idb';
import { snapshotFor } from './testing';

describe('openPersistence', () => {
  it('falls back to memory when IndexedDB is missing, and keeps data for the page', async () => {
    expect(typeof indexedDB).toBe('undefined');
    const persistence = await openPersistence();
    expect(persistence.memoryOnly).toBe(true);

    await persistence.saveSnapshot(snapshotFor('2026-10-24'));
    expect(await persistence.loadSnapshot()).toMatchObject({
      snapshotDate: '2026-10-24',
    });
    await persistence.clear();
    expect(await persistence.loadSnapshot()).toBeNull();
  });
});
