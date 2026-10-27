'use client';

import { useEffect, useRef, useState } from 'react';
import { useMedia } from '../lib/use-media';

/** A saved quantity rolls to its new value (ux-v2 README §4); under reduced motion it changes at once. */
export function RollingNumber({ value, format }: { value: number; format: (value: number) => string }) {
  const reduce = useMedia('(prefers-reduced-motion: reduce)');
  const [shown, setShown] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) return;
    const whole = Number.isInteger(from) && Number.isInteger(value);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 360);
      const eased = 1 - (1 - progress) ** 3;
      const next = from + (value - from) * eased;
      setShown(whole ? Math.round(next) : next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{format(reduce ? value : shown)}</>;
}
