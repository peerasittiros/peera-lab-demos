import { afterEach, describe, expect, it, vi } from 'vitest';
import { EARLY_SNAPSHOT, takeEarlySnapshot } from './early-snapshot';

afterEach(() => vi.unstubAllGlobals());

describe('takeEarlySnapshot', () => {
  it('returns null on the server', () => {
    expect(takeEarlySnapshot()).toBeNull();
  });

  it('hands over the head request once', async () => {
    const response = new Response('{}');
    const slot: Record<string, unknown> = {
      [EARLY_SNAPSHOT]: Promise.resolve(response),
    };
    vi.stubGlobal('window', slot);
    await expect(takeEarlySnapshot()).resolves.toBe(response);
    expect(EARLY_SNAPSHOT in slot).toBe(false);
    expect(takeEarlySnapshot()).toBeNull();
  });

  it('ignores anything that is not a request', () => {
    vi.stubGlobal('window', { [EARLY_SNAPSHOT]: 'stale' });
    expect(takeEarlySnapshot()).toBeNull();
  });
});
