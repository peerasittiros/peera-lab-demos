// The sample shops a visitor can open, and where the browser remembers the last one. Shared by the store
// (`chooseVariant`) and the head script that preloads the snapshot (`SnapshotPreload`), so both pick the same shop.

export const VARIANTS = ['minimart', 'cafe', 'hardware'];
export const VARIANT_KEY = 'stockline.variant';
