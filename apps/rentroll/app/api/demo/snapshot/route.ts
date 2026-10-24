import { loadSnapshotDocument } from '@/src/db/snapshot-document';
import { bangkokDate } from '@/src/domain/dates';

/**
 * The template as of today (SPEC §2.1): the only database read the browser store makes, cached for a day at the CDN.
 * No session and no writes. `x-snapshot-source` says whether the database or the generator served it.
 */
export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=86400';

export async function GET() {
  const { source, snapshot } = await loadSnapshotDocument(
    bangkokDate(new Date()),
  );
  return Response.json(snapshot, {
    headers: { 'Cache-Control': CACHE_CONTROL, 'x-snapshot-source': source },
  });
}
