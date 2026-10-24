import { buildSeed } from '@/src/db/seed/generator';
import { relativizeSeed } from '@/src/db/seed/relativize';
import type { Snapshot } from './schema';

/** The template as the snapshot route would serve it for `today`. For tests only. */
export function snapshotFor(today: string): Snapshot {
  return {
    schemaVersion: 1,
    snapshotDate: today,
    tables: relativizeSeed(buildSeed(), today) as Snapshot['tables'],
  };
}
