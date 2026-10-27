import type { Queryable } from '@peera/db';
import { sql } from 'drizzle-orm';

/**
 * Items whose balance differs from their ledger sum, across every tenant (the nightly check, 02 §4). Platform
 * maintenance, so deliberately not tenant-scoped.
 */
export async function balanceDrift(db: Queryable) {
  const { rows } = await db.execute<{
    tenant_id: string;
    item_id: string;
    on_hand: number;
    ledger: number;
  }>(sql`
    select b.tenant_id, b.item_id, b.on_hand, coalesce(m.total, 0)::int as ledger
    from stockline.item_balance b
    left join (select item_id, sum(quantity_base) as total from stockline.stock_movement group by item_id) m
      on m.item_id = b.item_id
    where b.on_hand <> coalesce(m.total, 0)`);
  return rows;
}
