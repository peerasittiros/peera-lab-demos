import type { Queryable } from '@peera/db';
import { sql } from 'drizzle-orm';
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
import type { SeedData } from './generator';

const CHUNK = 500;

async function insertChunked<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
) {
  for (let start = 0; start < rows.length; start += CHUNK)
    await insert(rows.slice(start, start + CHUNK));
}

/** Replaces one template tenant with freshly generated rows. Run it inside a transaction. */
export async function insertSeed(tx: Queryable, data: SeedData) {
  await tx.execute(
    sql`select stockline.delete_demo_tenant(${data.tenantId}::uuid)`,
  );
  await tx.insert(shopSettings).values(data.shopSettings);
  await tx.insert(unit).values(data.units);
  await tx.insert(category).values(data.categories);
  await tx.insert(supplier).values(data.suppliers);
  await tx.insert(appUser).values(data.users);
  await insertChunked(data.items, (rows) => tx.insert(item).values(rows));
  await insertChunked(data.itemUnits, (rows) =>
    tx.insert(itemUnit).values(rows),
  );
  await tx.insert(purchaseOrder).values(data.orders);
  await insertChunked(data.orderLines, (rows) =>
    tx.insert(purchaseOrderLine).values(rows),
  );
  await tx.insert(countSession).values(data.countSessions);
  await insertChunked(data.countLines, (rows) =>
    tx.insert(countLine).values(rows),
  );
  await insertChunked(data.movements, (rows) =>
    tx.insert(stockMovement).values(rows),
  );
  await insertChunked(data.balances, (rows) =>
    tx.insert(itemBalance).values(rows),
  );
  await tx.insert(auditEvent).values(data.auditEvents);
}
