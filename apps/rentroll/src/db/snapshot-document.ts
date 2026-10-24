import { withTenant } from '@peera/db';
import type { Snapshot } from '@/src/client-store/schema';
import { TEMPLATE_TENANT_ID, buildSeed } from './seed/generator';
import { relativizeSeed, type SeedRows } from './seed/relativize';
import { SNAPSHOT_TABLES } from './snapshot-tables';
import { getDb } from '../server/db';

/**
 * The template as of `today` (SPEC §2.1), built once for the snapshot route and the public invoice page. The database
 * is read read-only; if it is unreachable or empty the same document comes from the generator, so the demo never
 * breaks. `source` says which one was used.
 */
async function readTemplate(): Promise<SeedRows> {
  const scope = withTenant(getDb(), TEMPLATE_TENANT_ID);
  const rows: SeedRows = {};
  for (const { key, table } of SNAPSHOT_TABLES) {
    rows[key] = await scope.select(table);
  }
  if (!rows.rooms?.length) throw new Error('template tenant has no rooms');
  return rows;
}

export async function loadSnapshotDocument(
  today: string,
): Promise<{ source: 'db' | 'generator'; snapshot: Snapshot }> {
  let source: 'db' | 'generator' = 'db';
  let seed: SeedRows;
  try {
    seed = await readTemplate();
  } catch (error) {
    console.error('[rentroll] snapshot falls back to the generator:', error);
    source = 'generator';
    seed = buildSeed();
  }
  return {
    source,
    snapshot: {
      schemaVersion: 1,
      snapshotDate: today,
      tables: relativizeSeed(seed, today) as Snapshot['tables'],
    },
  };
}
