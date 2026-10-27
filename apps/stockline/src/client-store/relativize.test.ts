import { describe, expect, it } from 'vitest';
import { bangkokDay, bangkokWallTime, relativeTime } from './relativize';

// 25 Oct 2026, 12:00 in Bangkok (05:00 UTC).
const noon = new Date('2026-10-25T05:00:00.000Z');

describe('bangkokDay', () => {
  it('uses the Bangkok calendar day, not the UTC one', () => {
    expect(bangkokDay(new Date('2026-10-24T18:00:00.000Z'))).toBe('2026-10-25');
    expect(bangkokDay(new Date('2026-10-24T16:59:00.000Z'))).toBe('2026-10-24');
  });
});

describe('bangkokWallTime', () => {
  it('gives the wall-clock time on the day `daysAgo` before', () => {
    expect(bangkokWallTime(noon, 0, 600).toISOString()).toBe(
      '2026-10-25T03:00:00.000Z',
    );
    expect(bangkokWallTime(noon, 1, 600).toISOString()).toBe(
      '2026-10-24T03:00:00.000Z',
    );
  });

  it('carries across the month boundary', () => {
    expect(bangkokWallTime(noon, 25, 600).toISOString()).toBe(
      '2026-09-30T03:00:00.000Z',
    );
  });
});

describe('relativeTime', () => {
  it('returns the wall time for an earlier day', () => {
    expect(relativeTime(noon, 2, 540).toISOString()).toBe(
      '2026-10-23T02:00:00.000Z',
    );
  });

  it('caps today so a row never lands in the future', () => {
    // 01:00 UTC is 08:00 in Bangkok: 10:00 today is still ahead, so the cap applies.
    const early = new Date('2026-10-25T01:00:00.000Z');
    expect(relativeTime(early, 0, 600).toISOString()).toBe(
      '2026-10-25T00:46:00.000Z',
    );
    expect(relativeTime(early, 0, 600).getTime()).toBeLessThanOrEqual(
      early.getTime(),
    );
  });

  it('defaults a missing minute to 10:00', () => {
    expect(relativeTime(noon, 1, null).toISOString()).toBe(
      '2026-10-24T03:00:00.000Z',
    );
  });

  it('keeps the order of two rows on the same day', () => {
    const early = new Date('2026-10-25T01:00:00.000Z');
    const a = relativeTime(early, 0, 540).getTime();
    const b = relativeTime(early, 0, 600).getTime();
    expect(a).toBeLessThan(b);
  });
});
