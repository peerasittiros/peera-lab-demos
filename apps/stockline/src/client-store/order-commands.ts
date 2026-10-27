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
import { nextOrderNumber } from './views';

// Commands for purchase orders: create them from the reorder list (owner), and receive a delivery (any role, as on the
// server). Each order is one row with its lines; a receipt writes one `in` movement per line, with the PO number as the
// reference, then saves the order with its new received quantities and status (02 §3.1 items 4 and 5).

export type OrderGroupInput = {
  supplierId: string | null;
  lines: { itemId: string; qtyBase: number }[];
};

export async function createOrders(
  store: Store,
  groups: OrderGroupInput[],
  role: Role,
  options: { now?: () => Date } = {},
): Promise<CommandResult<{ created: { id: string; number: string }[] }>> {
  const denied = ownerOnly(role);
  if (denied) return denied;
  const ledger = store.getState().ledger;
  if (!ledger) return fail('not_ready', 'errors.unexpected');
  if (groups.length === 0 || groups.length > 20)
    return fail('invalid_input', 'errors.invalidInput');
  if (rowsOf(store, 'order').length + groups.length > ROW_CAPS.orders)
    return fail('row_cap', 'errors.rowCap');

  const now = (options.now ?? (() => new Date()))();
  const userId =
    store.getState().snapshot?.users.find((row) => row.role === role)?.id ??
    null;
  let next = Number(nextOrderNumber(ledger).slice(3));
  const ops: Op[] = [];
  const created: { id: string; number: string }[] = [];

  for (const group of groups) {
    const lines = group.lines.filter((line) => line.qtyBase > 0);
    if (lines.length === 0) continue;
    if (lines.some((line) => !ledger.entities.item[line.itemId]))
      return fail('not_found', 'errors.notFound');
    let leadTime = 0;
    if (group.supplierId) {
      const supplier = ledger.entities.supplier[group.supplierId];
      if (!supplier) return fail('not_found', 'errors.notFound');
      leadTime = Number(supplier.leadTimeDays);
    }
    const id = newId();
    const number = `PO-${String(next++).padStart(4, '0')}`;
    const expected = new Date(now.getTime() + leadTime * 24 * 60 * 60 * 1000);
    ops.push(
      entitySave(store, options, role, 'order', id, {
        number,
        supplierId: group.supplierId,
        status: 'ordered',
        orderedAt: now.toISOString(),
        expectedAt: expected.toISOString(),
        receivedAt: null,
        note: null,
        createdBy: userId,
        lines: lines.map((line) => ({
          id: newId(),
          itemId: line.itemId,
          qtyBase: line.qtyBase,
          receivedBase: 0,
        })),
      }),
    );
    created.push({ id, number });
  }

  return (await dispatchAll(store, ops))
    ? { ok: true, data: { created } }
    : fail('write_failed', 'errors.unexpected');
}

export async function receiveOrder(
  store: Store,
  orderId: string,
  lines: { lineId: string; qtyBase: number }[],
  role: Role,
  options: { now?: () => Date } = {},
): Promise<CommandResult<{ status: 'partial' | 'received'; number: string }>> {
  const ledger = store.getState().ledger;
  if (!ledger) return fail('not_ready', 'errors.unexpected');
  const order = ledger.entities.order[orderId];
  if (!order) return fail('not_found', 'errors.notFound');
  if (order.status !== 'ordered' && order.status !== 'partial')
    return fail('order_closed', 'errors.orderClosed');

  const receiving = lines.filter((line) => line.qtyBase > 0);
  if (receiving.length === 0)
    return fail('nothing_to_receive', 'errors.nothingToReceive');
  if (ledger.movements.length + receiving.length > ROW_CAPS.movements)
    return fail('row_cap', 'errors.rowCap');

  const orderLines = (
    order.lines as {
      id: string;
      itemId: string;
      qtyBase: number;
      receivedBase: number;
    }[]
  ).map((line) => ({ ...line }));
  const ops: Op[] = [];
  for (const entry of receiving) {
    const line = orderLines.find((candidate) => candidate.id === entry.lineId);
    if (!line) return fail('not_found', 'errors.notFound');
    if (entry.qtyBase > line.qtyBase - line.receivedBase)
      return fail('invalid_input', 'errors.invalidInput');
    const item = ledger.entities.item[line.itemId];
    ops.push(
      movementOp(store, options, role, {
        itemId: line.itemId,
        type: 'in',
        reason: 'received',
        quantityBase: entry.qtyBase,
        enteredQty: entry.qtyBase,
        enteredUnitId: item ? String(item.baseUnitId) : null,
        unitCostSatang:
          item?.costSatang == null ? null : Number(item.costSatang),
        reference: String(order.number),
      }),
    );
    line.receivedBase += entry.qtyBase;
  }

  const complete = orderLines.every(
    (line) => line.receivedBase >= line.qtyBase,
  );
  const now = (options.now ?? (() => new Date()))();
  ops.push(
    entitySave(store, options, role, 'order', orderId, {
      ...order,
      status: complete ? 'received' : 'partial',
      receivedAt: complete ? now.toISOString() : null,
      lines: orderLines,
    }),
  );

  return (await dispatchAll(store, ops))
    ? {
        ok: true,
        data: {
          status: complete ? 'received' : 'partial',
          number: String(order.number),
        },
      }
    : fail('write_failed', 'errors.unexpected');
}
