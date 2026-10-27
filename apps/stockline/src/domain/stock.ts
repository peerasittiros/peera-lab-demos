// Stockline's stock rules (02 §3.1, §4) as plain functions: no database, no React. The server and the UI both
// use them, so a number shown in the sheet is the number the ledger gets.

export type MovementType = 'in' | 'out' | 'adjust';
export type ItemStatus = 'out' | 'low' | 'ok';
export type LowStockRule = 'at_or_below_min' | 'below_min';
export type Role = 'owner' | 'staff';

/** Reasons per movement type. `opening` (import) and `count` (approved stock count) are set by the system. */
export const reasons = {
  in: ['received', 'returned_by_customer', 'other'],
  out: ['sold', 'used', 'damaged', 'expired', 'returned'],
  adjust: ['correction', 'found', 'damaged', 'expired'],
} as const satisfies Record<MovementType, readonly string[]>;
export const systemReasons = ['opening', 'count'] as const;
export type MovementReason =
  (typeof reasons)[MovementType][number] | (typeof systemReasons)[number];

/** Entered quantities allow up to 3 decimals (1.5 ถุง of 1,000 g). */
export const MAX_DECIMALS = 3;

/**
 * Entered quantity in a unit → base units. `factor` is how many base units one entered unit holds (1 for the
 * base unit itself). Rounds half away from zero to a whole base unit, since the ledger stores integers.
 */
export function toBase(quantity: number, factor: number): number {
  if (!Number.isFinite(quantity) || !Number.isInteger(factor) || factor < 1)
    throw new RangeError(
      'quantity must be finite and factor a positive integer',
    );
  const scaled = Math.round(quantity * 10 ** MAX_DECIMALS) * factor;
  const base = scaled / 10 ** MAX_DECIMALS;
  return Math.sign(base) * Math.round(Math.abs(base));
}

/** Base units → whole packs and the rest: 50 ขวด with a 24-pack → { packs: 2, rest: 2 }. */
export function splitIntoPacks(base: number, factor: number) {
  const sign = Math.sign(base) || 1;
  const absolute = Math.abs(base);
  return {
    packs: sign * Math.floor(absolute / factor),
    rest: sign * (absolute % factor),
  };
}

/** Rounds up to a whole number of packs (02 §3.1 item 4). */
export function roundUpToPack(quantity: number, packFactor: number): number {
  if (packFactor <= 1) return Math.max(0, Math.ceil(quantity));
  return Math.max(0, Math.ceil(quantity / packFactor) * packFactor);
}

/** `out` if on hand ≤ 0; `low` if on hand ≤ min (or < min with the `below_min` rule); else `ok`. */
export function itemStatus(
  onHand: number,
  minQty: number,
  rule: LowStockRule = 'at_or_below_min',
): ItemStatus {
  if (onHand <= 0) return 'out';
  const low = rule === 'below_min' ? onHand < minQty : onHand <= minQty;
  return low ? 'low' : 'ok';
}

export function needsReorder(
  onHand: number,
  minQty: number,
  rule: LowStockRule = 'at_or_below_min',
): boolean {
  return itemStatus(onHand, minQty, rule) !== 'ok';
}

/** `max(reorder_qty, min_qty × 2 − on_hand)`, rounded up to the pack size (02 §3.1 item 4). Never below one pack. */
export function suggestReorderQty({
  onHand,
  minQty,
  reorderQty,
  packFactor = 1,
}: {
  onHand: number;
  minQty: number;
  reorderQty: number;
  packFactor?: number;
}): number {
  const wanted = Math.max(reorderQty, minQty * 2 - onHand);
  return Math.max(roundUpToPack(wanted, packFactor), Math.max(1, packFactor));
}

/** Signed ledger quantity for a movement entered as a positive amount (adjust keeps its own sign). */
export function signedQuantity(type: MovementType, base: number): number {
  if (type === 'in') return Math.abs(base);
  if (type === 'out') return -Math.abs(base);
  return base;
}

export type NegativeStockCheck = 'ok' | 'warn' | 'block';

/**
 * 02 §4: stock below zero is allowed for the owner with a warning (shops sell before receiving); staff are
 * blocked.
 */
export function checkNegativeStock(
  role: Role,
  onHand: number,
  delta: number,
): NegativeStockCheck {
  if (onHand + delta >= 0 || delta >= 0) return 'ok';
  return role === 'owner' ? 'warn' : 'block';
}

/**
 * Moving average cost per base unit (satang) after receiving `quantity` at `unitCost`. Stock at or below zero
 * carries no value, so the new cost is the received cost.
 */
export function movingAverageCost(
  onHand: number,
  currentCost: number | null,
  quantity: number,
  unitCost: number,
): number {
  if (quantity <= 0) return currentCost ?? unitCost;
  if (onHand <= 0 || currentCost === null) return Math.round(unitCost);
  return Math.round(
    (onHand * currentCost + quantity * unitCost) / (onHand + quantity),
  );
}

/** Stock value at cost (satang); negative stock counts as zero. */
export function stockValue(onHand: number, costSatang: number | null): number {
  return Math.max(0, onHand) * (costSatang ?? 0);
}
