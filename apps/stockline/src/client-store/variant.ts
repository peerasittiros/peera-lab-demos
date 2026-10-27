// The sample shops a visitor can open, and where the browser remembers the last one and the demo role. Shared by
// the store (`chooseVariant`, `initialRole`) and the head script that preloads the snapshot (`SnapshotPreload`), so
// both pick the same shop and the same copy (staff get the one without money).

export const VARIANTS = ['minimart', 'cafe', 'hardware'];
export const VARIANT_KEY = 'stockline.variant';
export const ROLE_KEY = 'stockline.role';
