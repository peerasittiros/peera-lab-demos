'use client';

import { OpenInNewTab, useEmbedded } from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Field,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  Switch,
  ts,
} from '@peera/ui';
import { CameraOff, Flashlight, ScanLine, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import { useItemViews } from '../client-store/hooks';
import { findByCode, sampleCode } from '../client-store/views';
import type { ItemView } from '../domain/read-models';
import type { MovementType, Role } from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { formatQty } from '../lib/format';
import { AppLink } from './AppLink';
import { ItemStatusBadge } from './ItemStatusBadge';
import { buttonLink } from './styles';
import { createReader, type BarcodeReader } from './barcode-reader';

/** What the last read found. While one shows, the camera is off until the visitor scans again. */
type ScanResult = { item: ItemView } | { code: string } | null;

type CameraState =
  'starting' | 'running' | 'embedded-blocked' | 'denied' | 'unsupported';

function beep() {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 1320;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.09);
    oscillator.onended = () => void context.close();
  } catch {
    // No audio: the visual result is enough.
  }
}

/** Four corner marks framing where the code should sit (DESIGN §5 Scan overlay). */
function FrameCorners() {
  const corner = 'absolute h-7 w-7 border-[3px] border-product-accent';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-[16%_12%]">
      <span
        className={cn(
          corner,
          'top-0 left-0 rounded-tl-sm border-r-0 border-b-0',
        )}
      />
      <span
        className={cn(
          corner,
          'top-0 right-0 rounded-tr-sm border-b-0 border-l-0',
        )}
      />
      <span
        className={cn(
          corner,
          'bottom-0 left-0 rounded-bl-sm border-t-0 border-r-0',
        )}
      />
      <span
        className={cn(
          corner,
          'right-0 bottom-0 rounded-br-sm border-t-0 border-l-0',
        )}
      />
    </div>
  );
}

/**
 * Scan overlay (02 §3.1 item 3, §8 screen 2). Uses the browser's BarcodeDetector where it exists, else a
 * lazy-loaded fallback reader. Inside the website's iframe the camera needs `allow="camera"`; when the browser
 * still refuses, the visitor gets "open in a new tab" and can always type the code or simulate a scan. Every read
 * stops the camera and shows what it found, with the next steps (record In, Out or Adjust, open the item, or scan
 * again); nothing moves on by itself. The parent gives it a new `key` per opening, so state starts fresh; the camera
 * stops when it closes.
 */
export function ScanOverlay({
  locale,
  role,
  open,
  onOpenChange,
  onFound,
}: {
  locale: Locale;
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFound: (item: ItemView, type: MovementType) => void;
}) {
  const { m } = translator(locale);
  const embedded = useEmbedded();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BarcodeReader | null>(null);
  // The lookup reads the latest items without restarting the camera when the store changes.
  const views = useItemViews(role);
  const viewsRef = useRef(views);
  useEffect(() => {
    viewsRef.current = views;
  }, [views]);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [feedback, setFeedback] = useState(true);
  const feedbackRef = useRef(feedback);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ScanResult>(null);
  // A new session restarts the camera after a result.
  const [session, setSession] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const stop = useCallback(() => {
    readerRef.current?.stop();
    readerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const lookup = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      // Stop first: the reader can report the same code several times before it stops.
      stop();
      const found = findByCode(viewsRef.current, trimmed);
      if (found && feedbackRef.current) {
        beep();
        navigator.vibrate?.(60);
      }
      setResult(found ? { item: found } : { code: trimmed });
    },
    [stop],
  );

  const scanAgain = () => {
    setResult(null);
    setCode('');
    setCamera('starting');
    setSession((value) => value + 1);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera(embedded ? 'embedded-blocked' : 'unsupported');
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (error) {
        const name = (error as DOMException).name;
        if (cancelled) return;
        setCamera(
          embedded && (name === 'NotAllowedError' || name === 'SecurityError')
            ? 'embedded-blocked'
            : name === 'NotAllowedError'
              ? 'denied'
              : 'unsupported',
        );
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      const [track] = stream.getVideoTracks();
      const capabilities = (track?.getCapabilities?.() ?? {}) as {
        torch?: boolean;
      };
      setTorchAvailable(Boolean(capabilities.torch));
      const reader = await createReader();
      if (cancelled) return;
      if (!reader) {
        stop();
        setCamera('unsupported');
        return;
      }
      readerRef.current = reader;
      setCamera('running');
      reader.start(video, lookup);
    };
    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, session, embedded, lookup, stop]);

  const toggleTorch = async (next: boolean) => {
    const [track] = streamRef.current?.getVideoTracks() ?? [];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorch(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  const simulate = () => {
    const sample = sampleCode(viewsRef.current);
    if (!sample) return;
    setCode(sample);
    lookup(sample);
  };

  const blockedMessage =
    camera === 'embedded-blocked'
      ? m.scan.blockedEmbedded
      : camera === 'denied'
        ? m.scan.blockedDenied
        : camera === 'unsupported'
          ? m.scan.unsupported
          : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent locale={locale} className="md:w-[min(32rem,94vw)]">
        <SheetTitle locale={locale}>{m.scan.title}</SheetTitle>
        <SheetDescription locale={locale}>{m.scan.hint}</SheetDescription>

        {result ? (
          <ScanResultCard
            ref={resultRef}
            result={result}
            locale={locale}
            role={role}
            onRecord={onFound}
            onScanAgain={scanAgain}
          />
        ) : null}

        <div
          className={cn(
            'relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-md border border-line bg-surface-sunken',
            result && 'hidden',
          )}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            aria-hidden
            className={cn(
              'h-full w-full object-cover',
              camera !== 'running' && 'invisible',
            )}
          />
          {camera === 'running' || camera === 'starting' ? (
            <FrameCorners />
          ) : null}
          {camera === 'starting' ? (
            <p
              role="status"
              className={cn(
                ts('body-sm', locale),
                'absolute inset-x-0 bottom-3 m-0 text-center text-ink',
              )}
            >
              {m.scan.starting}
            </p>
          ) : null}
          {blockedMessage ? (
            <div
              role="status"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center"
            >
              <CameraOff
                aria-hidden
                size={24}
                strokeWidth={1.75}
                className="text-warning"
              />
              <p
                className={cn(
                  ts('body-sm', locale),
                  'm-0 max-w-[24rem] text-ink',
                )}
              >
                {blockedMessage}
              </p>
              {camera === 'embedded-blocked' ? (
                <OpenInNewTab locale={locale} />
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            'mt-3 flex flex-wrap items-center gap-x-5 gap-y-2',
            result && 'hidden',
          )}
        >
          {torchAvailable ? (
            <Button
              locale={locale}
              size="sm"
              variant="ghost"
              aria-pressed={torch}
              onClick={() => void toggleTorch(!torch)}
            >
              <Flashlight aria-hidden size={16} strokeWidth={1.75} />
              {m.scan.torch}
            </Button>
          ) : null}
          <Switch
            locale={locale}
            label={m.scan.sound}
            checked={feedback}
            onCheckedChange={setFeedback}
          />
        </div>

        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            lookup(code);
          }}
        >
          <Field
            locale={locale}
            label={m.scan.typeCode}
            hint={m.scan.codeLabel}
          >
            <Input
              value={code}
              inputMode="text"
              autoComplete="off"
              onChange={(event) => setCode(event.target.value)}
              className="code"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              locale={locale}
              type="submit"
              variant="secondary"
              disabled={!code.trim()}
            >
              {m.scan.find}
            </Button>
            <Button
              locale={locale}
              variant="ghost"
              onClick={simulate}
              title={m.scan.sampleHint}
            >
              <Sparkles aria-hidden size={16} strokeWidth={1.75} />
              {m.scan.sample}
            </Button>
          </div>
        </form>

        <p className={cn(ts('body-sm', locale), 'mt-5 mb-0')}>
          <AppLink
            href={`/${locale}/items/labels`}
            className="inline-flex min-h-11 items-center text-ink underline"
          >
            {m.scan.labelsLink}
          </AppLink>
        </p>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The result of one read, shown in place of the camera: the item with its stock and the next steps, or the unknown
 * code with "create an item" for the owner. It takes focus, so keyboard and screen-reader users land on it.
 */
function ScanResultCard({
  ref,
  result,
  locale,
  role,
  onRecord,
  onScanAgain,
}: {
  ref: Ref<HTMLDivElement>;
  result: NonNullable<ScanResult>;
  locale: Locale;
  role: Role;
  onRecord: (item: ItemView, type: MovementType) => void;
  onScanAgain: () => void;
}) {
  const { t, m } = translator(locale);
  const again = (
    <Button locale={locale} variant="ghost" onClick={onScanAgain}>
      <ScanLine aria-hidden size={16} strokeWidth={1.75} />
      {m.scan.again}
    </Button>
  );

  if ('code' in result)
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="status"
        className="mt-4 flex flex-col gap-3 rounded-md border border-line bg-surface-sunken p-4 outline-none"
      >
        <p className={cn(ts('label', locale), 'm-0 text-ink-muted')}>
          {m.scan.notFoundTitle}
        </p>
        <p className={cn(ts('body', locale), 'm-0 text-ink')}>
          {t('scan.unknownCode', { code: result.code })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {role === 'owner' ? (
            <AppLink
              href={`/${locale}/items/new?barcode=${encodeURIComponent(result.code)}`}
              className={buttonLink(locale, 'secondary')}
            >
              {m.scan.createWithCode}
            </AppLink>
          ) : null}
          {again}
        </div>
      </div>
    );

  const { item } = result;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="mt-4 flex flex-col gap-4 rounded-md border border-line bg-surface-raised p-4 outline-none"
    >
      <div className="flex items-start gap-3">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a small data URL or a static photo
          <img
            src={item.imageUrl}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-sm border border-line object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <p className={cn(ts('label', locale), 'm-0 text-ink-muted')}>
            {m.scan.resultTitle}
          </p>
          <p className={cn(ts('title', locale), 'm-0 text-ink')}>
            {nameIn(item, locale)}
          </p>
          <p className={cn(ts('body-sm', locale), 'm-0 text-ink-muted')}>
            <span className="code">{item.sku}</span>
            {` · ${t('quickMove.sheetDescription', {
              qty: formatQty(item.onHand, item.baseUnit, locale),
              min: formatQty(item.minQty, item.baseUnit, locale),
            })}`}
          </p>
          <div>
            <ItemStatusBadge status={item.status} locale={locale} />
          </div>
        </div>
      </div>
      <div
        role="group"
        aria-labelledby="scan-next"
        className="flex flex-col gap-2"
      >
        <p id="scan-next" className={cn(ts('ui', locale), 'm-0 text-ink')}>
          {m.scan.next}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(['in', 'out', 'adjust'] as const).map((type) => (
            <Button
              key={type}
              locale={locale}
              variant={type === 'in' ? 'primary' : 'secondary'}
              onClick={() => onRecord(item, type)}
            >
              {m.types[type]}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {again}
        <AppLink
          href={`/${locale}/items/${item.id}`}
          className={cn(
            ts('ui', locale),
            'inline-flex min-h-11 items-center px-2 text-ink underline',
          )}
        >
          {m.items.openItem}
        </AppLink>
      </div>
    </div>
  );
}
