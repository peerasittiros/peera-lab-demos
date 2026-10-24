/**
 * Slip images (SPEC §2.2). An uploaded slip is downscaled to fit 1280px and kept as an object URL for this page session
 * only: the op stores just the kind ('uploaded'), so IndexedDB never holds an image. After a reload the owner sees a
 * placeholder instead. The built-in sample slip is a static file.
 */

const MAX_SIDE = 1280;
const sessionUrls = new Map<string, string>();

export const SAMPLE_SLIP_URL = '/demo/slip-sample.svg';

/** Scales an image so its longer side is at most `MAX_SIDE`. Returns null when the browser can't decode it. */
export async function downscaleSlip(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85),
    );
  } catch {
    return null;
  }
}

/** Keeps the image for the rest of this page session. */
export function rememberSlip(paymentId: string, blob: Blob): void {
  const previous = sessionUrls.get(paymentId);
  if (previous) URL.revokeObjectURL(previous);
  sessionUrls.set(paymentId, URL.createObjectURL(blob));
}

/** The image URL for a slip: the sample, this session's upload, or null when there's no image to show. */
export function slipImageUrl(
  paymentId: string,
  kind: string | null,
): string | null {
  if (kind === 'sample') return SAMPLE_SLIP_URL;
  if (kind === 'uploaded') return sessionUrls.get(paymentId) ?? null;
  return null;
}
