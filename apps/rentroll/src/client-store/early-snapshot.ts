/** The `window` property where the head script (`SnapshotPreload`) leaves its snapshot request. */
export const EARLY_SNAPSHOT = '__rentrollSnapshot';

/**
 * Hands over the head script's request once, so the store reads that response instead of downloading the snapshot
 * again. Later calls (Reset, a second start) and visits that skipped the early request get `null` and fetch.
 */
export function takeEarlySnapshot(): Promise<Response> | null {
  if (typeof window === 'undefined') return null;
  const slot = window as unknown as Record<string, unknown>;
  const request = slot[EARLY_SNAPSHOT];
  delete slot[EARLY_SNAPSHOT];
  return request instanceof Promise ? (request as Promise<Response>) : null;
}
