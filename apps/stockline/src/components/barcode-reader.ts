// Camera barcode reading behind one small interface, so the scan overlay doesn't care which engine runs.

export type BarcodeReader = {
  start: (video: HTMLVideoElement, onCode: (code: string) => void) => void;
  stop: () => void;
};

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorClass = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

const WANTED = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'qr_code',
];

function nativeReader(
  Detector: BarcodeDetectorClass,
  formats: string[],
): BarcodeReader {
  const detector = new Detector({ formats });
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let last = '';
  return {
    start(video, onCode) {
      running = true;
      const tick = async () => {
        if (!running) return;
        try {
          if (video.readyState >= 2) {
            const [found] = await detector.detect(video);
            if (found?.rawValue && found.rawValue !== last) {
              last = found.rawValue;
              onCode(found.rawValue);
            }
          }
        } catch {
          // A frame that can't be read; try the next one.
        }
        if (running) timer = setTimeout(() => void tick(), 200);
      };
      void tick();
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
    },
  };
}

/**
 * The browser's BarcodeDetector when it reads the formats shops use (Chrome on Android, macOS, ChromeOS; Safari
 * on iOS 17+). Elsewhere it returns the lazy-loaded fallback, or null when none is available.
 */
export async function createReader(): Promise<BarcodeReader | null> {
  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorClass })
    .BarcodeDetector;
  if (Detector) {
    try {
      const supported = (await Detector.getSupportedFormats?.()) ?? WANTED;
      const formats = WANTED.filter((format) => supported.includes(format));
      if (formats.length > 0) return nativeReader(Detector, formats);
    } catch {
      // Fall through to the fallback.
    }
  }
  return loadFallbackReader();
}

/**
 * Fallback for browsers without BarcodeDetector (02 §7: `@zxing/browser`, lazy-loaded). The package is not
 * installed yet (it needs the user's go-ahead as a new dependency), so this returns null and the overlay offers
 * typing the code and the sample scan instead.
 */
async function loadFallbackReader(): Promise<BarcodeReader | null> {
  return null;
}
