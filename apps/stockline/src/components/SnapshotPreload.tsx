import { SNAPSHOT_HINT_KEY } from '../client-store/idb';
import { ROLE_KEY, VARIANT_KEY, VARIANTS } from '../client-store/variant';

// Runs while the HTML is parsed, long before the store starts (after hydration and two IndexedDB reads). It picks
// the shop the way `chooseVariant` does and the role the way `initialRole` does, and preloads that copy (staff get
// the one without money), so the store's fetch finds it in flight or done.
// It skips the preload when the hint says this browser already stored today's snapshot (Bangkok day, as the store).
function preloadSnapshot(
  variants: string[],
  variantKey: string,
  roleKey: string,
  hintKey: string,
) {
  try {
    const link = new URLSearchParams(location.search);
    const fromLink = link.get('variant');
    let stored: string | null = null;
    let storedRole: string | null = null;
    let hint: string | null = null;
    try {
      stored = localStorage.getItem(variantKey);
      storedRole = localStorage.getItem(roleKey);
      hint = localStorage.getItem(hintKey);
    } catch {
      // Storage blocked: the default shop, and always preload.
    }
    const variant =
      [fromLink, stored].find((v) => v !== null && variants.includes(v)) ??
      'minimart';
    const role =
      [link.get('role'), storedRole].find(
        (r) => r === 'owner' || r === 'staff',
      ) ?? 'owner';
    const today = new Date(Date.now() + 7 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    if (hint === `${variant}:${role}:${today}`) return;
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'fetch';
    preload.crossOrigin = 'anonymous';
    preload.href = `/api/demo/snapshot?variant=${encodeURIComponent(variant)}${role === 'staff' ? '&role=staff' : ''}`;
    document.head.appendChild(preload);
  } catch {
    // The store fetches the snapshot itself anyway.
  }
}

const script = `(${preloadSnapshot.toString()})(${JSON.stringify(VARIANTS)},${JSON.stringify(VARIANT_KEY)},${JSON.stringify(ROLE_KEY)},${JSON.stringify(SNAPSHOT_HINT_KEY)})`;

/** Preloads today's snapshot from the document head (first visit of the day). */
export function SnapshotPreload() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
