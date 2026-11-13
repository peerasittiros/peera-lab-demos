import { SNAPSHOT_HINT_KEY } from '../client-store/idb';

// Runs while the HTML is parsed, long before the store starts (after hydration and two IndexedDB reads), so the
// snapshot is in flight or done by the time the store asks for it. It skips the preload when the hint says this
// browser already stored today's snapshot (Bangkok day, as the store). One snapshot serves every role, so an empty
// hint means the first visit of the day.
function preloadSnapshot(hintKey: string) {
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
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'fetch';
    preload.crossOrigin = 'anonymous';
    preload.href = '/api/demo/snapshot';
    document.head.appendChild(preload);
  } catch {
    // The store fetches the snapshot itself anyway.
  }
}

const script = `(${preloadSnapshot.toString()})(${JSON.stringify(SNAPSHOT_HINT_KEY)})`;

/** Preloads today's snapshot from the document head (first visit of the day). */
export function SnapshotPreload() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
