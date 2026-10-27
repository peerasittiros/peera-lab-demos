// Photos for the sample shops' items: CC0 photos from rawpixel and StockSnap (found through Openverse), chosen by
// eye and resized to 320 × 320 WebP in `public/products/<type>.webp`. Items that look alike share a photo (both
// drinking-water sizes, every paint can). Sources and licences are in `public/products/CREDITS.json`.
// The map is generated; items not in it keep the icon tile.

const PHOTOS: Record<string, string> = {
};

/** The photo path for a sample item (`variant`, `sku`), or null when it has none. */
export function sampleImage(variant: string | null | undefined, sku: string | null | undefined): string | null {
  if (!variant || !sku) return null;
  const type = PHOTOS[`${variant}/${sku}`];
  return type ? `/products/${type}.webp` : null;
}
