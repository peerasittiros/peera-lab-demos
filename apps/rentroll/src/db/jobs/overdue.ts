import type { Db } from '@peera/db';
import { sql } from 'drizzle-orm';
import { sendReminder } from '../writes/payments';

/**
 * The daily overdue job (01 §6.1, Spec corrections 7): one reminder per overdue invoice per Bangkok day. It runs
 * from the app's single daily cron, so it works across every tenant of the demo; each reminder is its own
 * transaction, and a day already reminded is skipped.
 */
export async function runOverdueReminders(db: Db, today: string): Promise<{ sent: number }> {
  const due = await db.execute<{ tenant_id: string; id: string }>(sql`
    select tenant_id, id from rentroll.invoice
    where status in ('sent', 'partially_paid') and due_date < ${today}`);
  let sent = 0;
  for (const row of due.rows) {
    const already = await db.execute(sql`
      select 1 from platform.mock_message
      where tenant_id = ${row.tenant_id}::uuid
        and payload->>'kind' = 'overdue_reminder'
        and payload->>'invoiceId' = ${row.id}
        and payload->>'date' = ${today}
      limit 1`);
    if (already.rows.length > 0) continue;
    await db.transaction((tx) => sendReminder(tx, row.tenant_id, { invoiceId: row.id, today }));
    sent += 1;
  }
  return { sent };
}
