import { ROW_CAPS } from '../domain/limits';
import type { Role } from '../domain/stock';
import { newId } from './ids';
import {
  dispatchAll,
  entitySave,
  fail,
  movementOp,
  ownerOnly,
  rowsOf,
} from './master-commands';
import type { CommandResult } from './commands';
import type { Op } from './ops';
import type { Store } from './store';

// Stock counts (02 §3.1 item 6). A count is one row with its lines: each line keeps the expected quantity from when the
// count started and the counted quantity once someone has counted it. Approval writes one `adjust` per difference,
// counted − expected, with reason `count` and the session number as the reference. Sales recorded while the count was
// running are kept, because the difference is measured against the start.

export type CountScopeInput =
  { kind: 'all' } | { kind: 'category'; categoryId: string };

function nextCountNumber(store: Store): string {
  const highest = rowsOf(store, 'count').reduce((max, row) => {
    const match = /^CNT-(\d+)$/.exec(String(row.number));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `CNT-${String(highest + 1).padStart(4, '0')}`;
}

function session(store: Store, id: string) {
  return store.getState().ledger?.entities.count[id];
}

type CountLine = {
  id: string;
  itemId: string;
  expected: number;
  counted: number | null;
  countedAt: string | null;
};

export async function startCount(
  store: Store,
  input: { scope: CountScopeInput; blind: boolean },
  role: Role,
  options: { now?: () => Date } = {},
): Promise<CommandResult<{ id: string; number: string }>> {
  const ledger = store.getState().ledger;
  if (!ledger) return fail('not_ready', 'errors.unexpected');
  if (rowsOf(store, 'count').length >= ROW_CAPS.counts)
    return fail('row_cap', 'errors.rowCap');
  const items = Object.values(ledger.entities.item).filter(
    (row) =>
      row.active !== false &&
      (input.scope.kind === 'all' || row.categoryId === input.scope.categoryId),
  );
  if (items.length === 0)
    return fail('nothing_selected', 'errors.nothingSelected');

  const id = newId();
  const number = nextCountNumber(store);
  const userId =
    store.getState().snapshot?.users.find((row) => row.role === role)?.id ??
    null;
  const now = (options.now ?? (() => new Date()))();
  const lines: CountLine[] = items.map((row) => ({
    id: newId(),
    itemId: row.id,
    expected: ledger.balances[row.id] ?? 0,
    counted: null,
    countedAt: null,
  }));
  const ops: Op[] = [
    entitySave(store, options, role, 'count', id, {
      number,
      scope: input.scope,
      status: 'open',
      blind: input.blind,
      startedAt: now.toISOString(),
      startedBy: userId,
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
      lines,
    }),
  ];
  return (await dispatchAll(store, ops))
    ? { ok: true, data: { id, number } }
    : fail('write_failed', 'errors.unexpected');
}

/** Records a counted quantity for one line; returns the expected quantity, which the page reveals after counting. */
export async function saveCountLine(
  store: Store,
  sessionId: string,
  itemId: string,
  counted: number,
  role: Role,
  options: { now?: () => Date } = {},
): Promise<CommandResult<{ expected: number }>> {
  const row = session(store, sessionId);
  if (!row) return fail('not_found', 'errors.notFound');
  if (row.status !== 'open') return fail('count_closed', 'errors.countClosed');
  if (!Number.isInteger(counted) || counted < 0 || counted > 10_000_000)
    return fail('invalid_input', 'errors.invalidInput');
  const lines = row.lines as CountLine[];
  const line = lines.find((entry) => entry.itemId === itemId);
  if (!line) return fail('not_found', 'errors.notFound');

  const now = (options.now ?? (() => new Date()))();
  const next = lines.map((entry) =>
    entry.itemId === itemId
      ? { ...entry, counted, countedAt: now.toISOString() }
      : entry,
  );
  return (await dispatchAll(store, [
    entitySave(store, options, role, 'count', sessionId, {
      ...row,
      lines: next,
    }),
  ]))
    ? { ok: true, data: { expected: line.expected } }
    : fail('write_failed', 'errors.unexpected');
}

export async function submitCount(
  store: Store,
  sessionId: string,
  role: Role,
  options: { now?: () => Date } = {},
): Promise<CommandResult<{ sessionId: string }>> {
  const row = session(store, sessionId);
  if (!row) return fail('not_found', 'errors.notFound');
  if (row.status !== 'open') return fail('count_closed', 'errors.countClosed');
  const lines = row.lines as CountLine[];
  if (lines.some((line) => line.counted === null))
    return fail('count_incomplete', 'errors.countIncomplete');
  const now = (options.now ?? (() => new Date()))();
  return (await dispatchAll(store, [
    entitySave(store, options, role, 'count', sessionId, {
      ...row,
      status: 'submitted',
      submittedAt: now.toISOString(),
    }),
  ]))
    ? { ok: true, data: { sessionId } }
    : fail('write_failed', 'errors.unexpected');
}

/** Owner approval: each difference becomes an `adjust` with reason `count`, linked to the session. */
export async function approveCount(
  store: Store,
  sessionId: string,
  role: Role,
  options: { now?: () => Date } = {},
): Promise<CommandResult<{ adjusted: number }>> {
  const denied = ownerOnly(role);
  if (denied) return denied;
  const ledger = store.getState().ledger;
  const row = session(store, sessionId);
  if (!ledger || !row) return fail('not_found', 'errors.notFound');
  if (row.status !== 'submitted')
    return fail('count_closed', 'errors.countClosed');
  const lines = row.lines as CountLine[];
  const differences = lines.filter(
    (line) => line.counted !== null && line.counted !== line.expected,
  );
  if (ledger.movements.length + differences.length > ROW_CAPS.movements)
    return fail('row_cap', 'errors.rowCap');

  const now = (options.now ?? (() => new Date()))();
  const ops: Op[] = differences.map((line) =>
    movementOp(store, options, role, {
      itemId: line.itemId,
      type: 'adjust',
      reason: 'count',
      quantityBase: (line.counted as number) - line.expected,
      enteredQty: null,
      enteredUnitId:
        ledger.entities.item[line.itemId]?.baseUnitId == null
          ? null
          : String(ledger.entities.item[line.itemId]!.baseUnitId),
      unitCostSatang: null,
      reference: String(row.number),
      countSessionId: sessionId,
    }),
  );
  const userId =
    store.getState().snapshot?.users.find((user) => user.role === role)?.id ??
    null;
  ops.push(
    entitySave(store, options, role, 'count', sessionId, {
      ...row,
      status: 'approved',
      approvedAt: now.toISOString(),
      approvedBy: userId,
    }),
  );
  return (await dispatchAll(store, ops))
    ? { ok: true, data: { adjusted: differences.length } }
    : fail('write_failed', 'errors.unexpected');
}
