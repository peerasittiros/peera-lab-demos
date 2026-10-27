import { MAX_IMAGE_CHARS } from '../domain/limits';

// Uploaded pictures (the shop logo, item photos) stay in the visitor's browser: each is cropped to a centred square,
// scaled down and encoded small enough to keep in IndexedDB with the rest of the demo. Nothing is sent to a server.

/** Larger files are refused before they are read (a phone photo is 2–6 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ImageProblem = 'type' | 'size' | 'read';

export class ImageError extends Error {
  constructor(readonly problem: ImageProblem) {
    super(`image ${problem}`);
  }
}

/**
 * A picture as a data URL: centre-cropped to a `size` × `size` square, WebP where the browser can encode it (JPEG
 * otherwise, as older Safari), at the highest quality that stays under the stored size limit.
 */
export async function imageToDataUrl(
  file: File,
  { size }: { size: number },
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ImageError('type');
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageError('size');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC in browsers that cannot decode it, or a broken file.
    throw new ImageError('read');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageError('read');
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();

  for (const quality of [0.82, 0.68, 0.5]) {
    const blob =
      (await encode(canvas, 'image/webp', quality)) ??
      (await encode(canvas, 'image/jpeg', quality));
    if (!blob) break;
    const url = await asDataUrl(blob);
    if (url.length <= MAX_IMAGE_CHARS) return url;
  }
  throw new ImageError('size');
}

/** The blob in that type, or null when the browser encodes something else instead (no WebP in older Safari). */
function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => resolve(blob && blob.type === type ? blob : null),
      type,
      quality,
    ),
  );
}

function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImageError('read'));
    reader.readAsDataURL(blob);
  });
}
