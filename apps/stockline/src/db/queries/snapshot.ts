import { withTenant, type Queryable } from '@peera/db';
import type { TemplateRows } from '../../client-store/snapshot';
import {
  appUser,
  auditEvent,
  category,
  countLine,
  countSession,
  item,
  itemBalance,
  itemUnit,
  purchaseOrder,
  purchaseOrderLine,
  shopSettings,
  stockMovement,
  supplier,
  unit,
} from '../schema';

/**
 * Reads one template tenant, read-only, for the snapshot route. Every table goes through `withTenant`, so each query
 * carries `tenant_id`. Rows keep their table types; `toSnapshot` applies the relative dates.
 */
export async function readTemplateRows(
  db: Queryable,
  tenantId: string,
): Promise<TemplateRows> {
  const scope = withTenant(db, tenantId);
  const [
    settings,
    units,
    categories,
    suppliers,
    users,
    items,
    itemUnits,
    orders,
    orderLines,
    countSessions,
    countLines,
    movements,
    balances,
    auditEvents,
  ] = await Promise.all([
    scope.select(shopSettings),
    scope.select(unit),
    scope.select(category),
    scope.select(supplier),
    scope.select(appUser),
    scope.select(item),
    scope.select(itemUnit),
    scope.select(purchaseOrder),
    scope.select(purchaseOrderLine),
    scope.select(countSession),
    scope.select(countLine),
    scope.select(stockMovement),
    scope.select(itemBalance),
    scope.select(auditEvent),
  ]);
  const [shop] = settings;
  if (!shop)
    throw new Error(
      `[stockline] template ${tenantId} has no shop_settings row`,
    );
  return {
    shopSettings: shop,
    units,
    categories,
    suppliers,
    users,
    items,
    itemUnits,
    orders,
    orderLines,
    countSessions,
    countLines,
    movements,
    balances,
    auditEvents,
  };
}
