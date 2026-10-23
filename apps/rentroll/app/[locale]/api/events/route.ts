import { event, withTenant } from '@peera/db';
import { gt } from 'drizzle-orm';
import { getContext } from '@/src/server/context';

/**
 * The live feed for the DemoSplit (platform §6.5): events of this visitor's sandbox after `after`, oldest first.
 * Under `[locale]` so the proxy attaches the visitor's session. The kit polls it with `?poll=1&after=<id>`.
 */
export async function GET(request: Request) {
  const { db, tenantId } = await getContext();
  const url = new URL(request.url);
  const after = Number(url.searchParams.get('after') ?? 0);
  const rows = await withTenant(db, tenantId).select(event, gt(event.id, Number.isSafeInteger(after) ? after : 0));
  const events = rows
    .sort((a, b) => a.id - b.id)
    .slice(0, 50)
    .map((row) => ({ id: row.id, kind: row.kind, payload: row.payload, at: row.at.toISOString() }));
  return Response.json({ events }, { headers: { 'cache-control': 'no-store' } });
}
