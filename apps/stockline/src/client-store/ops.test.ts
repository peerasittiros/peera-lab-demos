import { describe, expect, it } from 'vitest';
import { applyOp, ledgerFromSnapshot, replay } from './ops';
import { recordOp, seedSnapshot } from './testing';

const snapshot = seedSnapshot();
const itemId = String(snapshot.items[0]!.id);

describe('applyOp', () => {
  it('records an in and moves the balance by the quantity', () => {
    const before = ledgerFromSnapshot(snapshot);
    const { ledger, outcome } = applyOp(
      before,
      recordOp(snapshot, { type: 'in', quantityBase: 5 }),
    );
    expect(outcome).toBe('applied');
    expect(ledger.balances[itemId]).toBe((before.balances[itemId] ?? 0) + 5);
    const last = ledger.movements.at(-1)!;
    expect(last.quantityBase).toBe(5);
    expect(last.balanceAfter).toBe(ledger.balances[itemId]);
    expect(last.visitor).toBe(true);
  });

  it('signs an out negative and computes balance_after from the reducer', () => {
    const before = ledgerFromSnapshot(snapshot);
    const { ledger } = applyOp(
      before,
      recordOp(snapshot, { type: 'out', reason: 'sold', quantityBase: 3 }),
    );
    expect(ledger.movements.at(-1)!.quantityBase).toBe(-3);
    expect(ledger.balances[itemId]).toBe((before.balances[itemId] ?? 0) - 3);
  });

  it('keeps the sign of an adjust', () => {
    const { ledger } = applyOp(
      ledgerFromSnapshot(snapshot),
      recordOp(snapshot, {
        type: 'adjust',
        reason: 'correction',
        quantityBase: -4,
      }),
    );
    expect(ledger.movements.at(-1)!.quantityBase).toBe(-4);
  });

  it('is pure: the input ledger is not changed', () => {
    const before = ledgerFromSnapshot(snapshot);
    const copy = structuredClone(before);
    applyOp(before, recordOp(snapshot, { quantityBase: 9 }));
    expect(before).toEqual(copy);
  });

  it('treats the same op id twice as a no-op', () => {
    const op = recordOp(snapshot, { quantityBase: 2 });
    const once = applyOp(ledgerFromSnapshot(snapshot), op);
    const twice = applyOp(once.ledger, op);
    expect(twice.outcome).toBe('duplicate');
    expect(twice.ledger).toBe(once.ledger);
  });

  it('skips an op for an item the snapshot does not have', () => {
    const op = recordOp(snapshot, { quantityBase: 2 });
    op.payload.itemId = '00000000-0000-0000-0000-000000000000';
    const ledger = ledgerFromSnapshot(snapshot);
    expect(applyOp(ledger, op)).toEqual({ ledger, outcome: 'skipped' });
  });

  it('skips a zero or fractional quantity', () => {
    const ledger = ledgerFromSnapshot(snapshot);
    expect(
      applyOp(ledger, recordOp(snapshot, { quantityBase: 0 })).outcome,
    ).toBe('skipped');
    expect(
      applyOp(ledger, recordOp(snapshot, { quantityBase: 1.5 })).outcome,
    ).toBe('skipped');
  });
});

describe('replay', () => {
  const ops = [
    recordOp(snapshot, { type: 'in', quantityBase: 4 }),
    recordOp(snapshot, { type: 'out', reason: 'sold', quantityBase: 1 }),
    recordOp(snapshot, { type: 'adjust', reason: 'found', quantityBase: 2 }),
  ];

  it('equals applying the ops one by one', () => {
    let ledger = ledgerFromSnapshot(snapshot);
    for (const op of ops) ledger = applyOp(ledger, op).ledger;
    expect(replay(snapshot, ops).ledger).toEqual(ledger);
  });

  it('is the same every time it runs', () => {
    expect(replay(snapshot, ops).ledger).toEqual(replay(snapshot, ops).ledger);
  });

  it('counts skipped ops', () => {
    const bad = recordOp(snapshot, { quantityBase: 1 });
    bad.payload.itemId = 'missing';
    expect(replay(snapshot, [...ops, bad]).skipped).toBe(1);
  });
});
