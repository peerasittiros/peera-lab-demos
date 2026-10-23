import { describe, expect, it } from 'vitest';
import { canMove } from './repair';

describe('canMove', () => {
  it('lets an open ticket move to any other status', () => {
    expect(canMove('new', 'scheduled')).toBe(true);
    expect(canMove('scheduled', 'in_progress')).toBe(true);
    expect(canMove('in_progress', 'done')).toBe(true);
    expect(canMove('in_progress', 'cancelled')).toBe(true);
  });

  it('refuses a move to the same status and any move out of a closed ticket', () => {
    expect(canMove('new', 'new')).toBe(false);
    expect(canMove('done', 'in_progress')).toBe(false);
    expect(canMove('cancelled', 'new')).toBe(false);
  });
});
