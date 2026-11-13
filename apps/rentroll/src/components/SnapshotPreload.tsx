import { SNAPSHOT_HINT_KEY } from '../client-store/idb';
import { EARLY_SNAPSHOT } from '../client-store/early-snapshot';

// Runs while the HTML is parsed, long before the store starts (after hydration and two IndexedDB reads), so the
// snapshot is in flight or done by the time the store asks for it. It skips the request when the hint says this
// browser already stored today's snapshot (Bangkok day, as the store). One snapshot serves every role, so an empty
// hint means the first visit of the day.
//
// It starts the request itself and leaves the promise on `window` for `takeEarlySnapshot()`, rather than adding a
// `<link rel=preload>`: the response is not cacheable in the browser (`s-maxage` only), so a `fetch()` that missed
// the preload (Chrome drops unused preloads around the load event) downloaded the snapshot a second time.
function preloadSnapshot(hintKey: string, slot: string) {
  try {
    let hint: string | null = null;
    try {
      hint = localStorage.getItem(hintKey);
    } catch {
      // Storage blocked: always preload, which only costs a cached request.
    }
    const today = new Date(Date.now() + 7 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    if (hint === today) return;
    const request = fetch('/api/demo/snapshot');
    // Unread, a failed request would log an unhandled rejection; the store retries on its own.
    request.catch(() => undefined);
    (window as unknown as Record<string, unknown>)[slot] = request;
  } catch {
    // The store fetches the snapshot itself anyway.
  }
}

const script = `(${preloadSnapshot.toString()})(${JSON.stringify(SNAPSHOT_HINT_KEY)}, ${JSON.stringify(EARLY_SNAPSHOT)})`;

/** Requests today's snapshot from the document head (first visit of the day). */
export function SnapshotPreload() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
