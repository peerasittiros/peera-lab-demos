import { SNAPSHOT_HINT_KEY } from '../client-store/idb';
import { VARIANT_KEY, VARIANTS } from '../client-store/variant';

// Runs while the HTML is parsed, long before the store starts (after hydration and two IndexedDB reads). It picks
// the shop the way `chooseVariant` does and preloads that snapshot, so the store's fetch finds it in flight or done.
// It skips the preload when the hint says this browser already stored today's snapshot (Bangkok day, as the store).
function preloadSnapshot(variants: string[], variantKey: string, hintKey: string) {
  try {
    const fromLink = new URLSearchParams(location.search).get('variant');
    let stored: string | null = null;
    let hint: string | null = null;
    try {
      stored = localStorage.getItem(variantKey);
      hint = localStorage.getItem(hintKey);
    } catch {
      // Storage blocked: the default shop, and always preload.
    }
    const variant = [fromLink, stored].find((v) => v !== null && variants.includes(v)) ?? 'minimart';
    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    if (hint === `${variant}:${today}`) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'fetch';
    link.crossOrigin = 'anonymous';
    link.href = `/api/demo/snapshot?variant=${encodeURIComponent(variant)}`;
    document.head.appendChild(link);
  } catch {
    // The store fetches the snapshot itself anyway.
  }
}

const script = `(${preloadSnapshot.toString()})(${JSON.stringify(VARIANTS)},${JSON.stringify(VARIANT_KEY)},${JSON.stringify(SNAPSHOT_HINT_KEY)})`;

/** Preloads today's snapshot from the document head (first visit of the day). */
export function SnapshotPreload() {
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />;
}
