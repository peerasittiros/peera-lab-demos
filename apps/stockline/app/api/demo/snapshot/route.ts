import { forRole, toSnapshot } from '@/src/client-store/snapshot';
import { readTemplateRows } from '@/src/db/queries/snapshot';
import {
  buildSeedVariant,
  STOCKLINE_VARIANTS,
  TEMPLATE_TENANTS,
  type StocklineVariant,
} from '@/src/db/seed/generator';
import { getDb } from '@/src/server/db';

// The template shop for one variant, as of today in Bangkok. The only database read a visitor's browser makes,
// once a day per CDN region (SPEC §2.1). Read-only: nothing here writes.

export const dynamic = 'force-dynamic';

const SHARED_CACHE = 'public, s-maxage=86400, stale-while-revalidate=86400';

function parseVariant(value: string | null): StocklineVariant | null {
  if (value === null) return 'minimart';
  return (STOCKLINE_VARIANTS as readonly string[]).includes(value)
    ? (value as StocklineVariant)
    : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const variant = parseVariant(params.get('variant'));
  // Staff get the copy without money; anything else is the owner's copy.
  const role = params.get('role') === 'staff' ? 'staff' : 'owner';
  if (!variant)
    return Response.json({ error: 'unknown variant' }, { status: 400 });

  const now = new Date();
  try {
    const rows = await readTemplateRows(getDb(), TEMPLATE_TENANTS[variant]);
    return Response.json(forRole(toSnapshot(rows, variant, now), role), {
      headers: {
        'Cache-Control': SHARED_CACHE,
        'x-snapshot-source': 'database',
      },
    });
  } catch (error) {
    // The database is unreachable: serve the same shape from the seed generator. Not cached, so the next visit
    // tries the database again.
    console.error(
      '[stockline] snapshot: database unavailable, using the seed generator',
      error,
    );
    return Response.json(
      forRole(toSnapshot(buildSeedVariant(variant), variant, now), role),
      {
        headers: {
          'Cache-Control': 'no-store',
          'x-snapshot-source': 'generator',
        },
      },
    );
  }
}
