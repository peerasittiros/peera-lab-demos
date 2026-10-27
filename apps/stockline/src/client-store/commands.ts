import {
  checkNegativeStock,
  reasons,
  signedQuantity,
  toBase,
  type MovementType,
  type Role,
} from '../domain/stock';
import type { RecordMovementInput } from '../domain/movement-input';
import { newId } from './ids';
import type { Op } from './ops';
import type { Store } from './store';

// Commands: what a button does. Each one checks its input with the same Zod schema as the server action, checks the
// role, builds an op and dispatches it. They return the same `{ ok, data } | { ok: false, error }` shape as the server
// actions, so the UI handles both the same way.

export type CommandError = { code: string; messageKey: string };
export type CommandResult<T> =
  { ok: true; data: T } | { ok: false; error: CommandError };

export type RecordMovementResult = {
  movementId: string;
  quantityBase: number;
  onHand: number;
  /** Set when the owner took stock below zero: the UI warned, and the move went through. */
  warning: 'negative' | null;
};

const fail = (
  code: string,
  messageKey: string,
): { ok: false; error: CommandError } => ({
  ok: false,
  error: { code, messageKey },
});

export async function recordMovement(
  store: Store,
  input: RecordMovementInput,
  role: Role,
  options: { now?: () => Date } = {},
): Promise<CommandResult<RecordMovementResult>> {
  // Zod loads on the first save, not with the page (`schemas.ts`).
  const { movementSchema } = await import('./schemas');
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return fail('invalid_input', 'errors.invalidInput');
  const value = parsed.data;

  const state = store.getState();
  const { snapshot, ledger } = state;
  if (!snapshot || !ledger) return fail('not_ready', 'errors.unexpected');

  const type = value.type as MovementType;
  if (!(reasons[type] as readonly string[]).includes(value.reason))
    return fail('reason_required', 'errors.reasonRequired');
  if (type === 'adjust' && !value.note)
    return fail('note_required', 'errors.noteRequired');

  const target = snapshot.items.find(
    (row) => String(row.id) === value.itemId && row.active !== false,
  );
  if (!target) return fail('not_found', 'errors.notFound');
  const baseUnitId = String(target.baseUnitId);

  let factor = 1;
  if (value.unitId && value.unitId !== baseUnitId) {
    const pack = snapshot.itemUnits.find(
      (row) =>
        String(row.itemId) === value.itemId &&
        String(row.unitId) === value.unitId,
    );
    if (!pack) return fail('invalid_input', 'errors.invalidInput');
    factor = Number(pack.factor);
  }

  let base: number;
  try {
    base = signedQuantity(type, toBase(value.quantity, factor));
  } catch {
    return fail('invalid_input', 'errors.invalidInput');
  }
  if (base === 0) return fail('quantity_required', 'errors.quantityRequired');

  const onHand = ledger.balances[value.itemId] ?? 0;
  const check = checkNegativeStock(role, onHand, base);
  if (check === 'block')
    return fail('stock_below_zero', 'errors.stockBelowZero');

  const unitCostSatang =
    role === 'owner' && type === 'in' && value.unitCostBaht != null
      ? Math.round(value.unitCostBaht * 100)
      : null;
  const user = snapshot.users.find((row) => row.role === role);
  const id = newId();
  const op: Op = {
    id,
    kind: 'movement.record',
    at: (options.now ?? (() => new Date()))().toISOString(),
    role,
    payload: {
      itemId: value.itemId,
      type,
      reason: value.reason,
      enteredQty: Math.abs(value.quantity),
      enteredUnitId: value.unitId ?? baseUnitId,
      quantityBase: type === 'adjust' ? base : Math.abs(base),
      unitCostSatang,
      reference: value.reference || null,
      note: value.note || null,
      userId: user ? String(user.id) : null,
    },
  };

  let outcome;
  try {
    outcome = await store.dispatch(op);
  } catch {
    return fail('write_failed', 'errors.unexpected');
  }
  if (outcome !== 'applied') return fail('write_failed', 'errors.unexpected');
  return {
    ok: true,
    data: {
      movementId: id,
      quantityBase: base,
      onHand: store.getState().ledger?.balances[value.itemId] ?? onHand + base,
      warning: check === 'warn' ? 'negative' : null,
    },
  };
}
