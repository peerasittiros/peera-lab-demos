import { buildSeedVariant, type StocklineVariant } from '../db/seed/generator';
import type { RecordMovementOp } from './ops';
import { toSnapshot, type Snapshot } from './snapshot';

// Fixtures shared by the client-store tests: the seed generator's shop as a snapshot, measured from a fixed
// instant so the Bangkok day is known.

/** 25 Oct 2026, 12:00 in Bangkok. */
export const TEST_NOW = new Date('2026-10-25T05:00:00.000Z');

export function seedSnapshot(
  variant: StocklineVariant = 'minimart',
  now = TEST_NOW,
): Snapshot {
  return toSnapshot(buildSeedVariant(variant), variant, now);
}

export function recordOp(
  snapshot: Snapshot,
  overrides: Partial<RecordMovementOp['payload']> & {
    id?: string;
    at?: string;
  } = {},
): RecordMovementOp {
  const {
    id = crypto.randomUUID(),
    at = TEST_NOW.toISOString(),
    ...payload
  } = overrides;
  const item = snapshot.items[0];
  if (!item) throw new Error('the fixture shop has no items');
  return {
    id,
    kind: 'movement.record',
    at,
    role: 'owner',
    payload: {
      itemId: String(item.id),
      type: 'in',
      reason: 'received',
      enteredQty: 2,
      enteredUnitId: null,
      quantityBase: 2,
      unitCostSatang: null,
      reference: null,
      note: null,
      userId: null,
      ...payload,
    },
  };
}
