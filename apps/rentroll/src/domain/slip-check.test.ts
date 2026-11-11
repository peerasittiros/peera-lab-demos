import { describe, expect, it } from 'vitest';
import { slipCheck } from './slip-check';

describe('slip amount check', () => {
  const open = [{ outstanding: 723200 }, { outstanding: 460800 }];

  it('matches the whole balance or the oldest bill', () => {
    expect(slipCheck(1184000, open)).toEqual({ kind: 'match' });
    expect(slipCheck(723200, open)).toEqual({ kind: 'match' });
  });

  it('says how much short or over the balance', () => {
    expect(slipCheck(700000, open)).toEqual({ kind: 'short', diff: 484000 });
    expect(slipCheck(1200000, open)).toEqual({ kind: 'over', diff: 16000 });
  });

  it('calls any payment over when nothing is owed', () => {
    expect(slipCheck(5000, [])).toEqual({ kind: 'over', diff: 5000 });
  });
});
