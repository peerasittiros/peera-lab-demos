'use client';

import { useEffect, useRef, useState } from 'react';
import { useMedia } from '@/src/lib/use-media';

/**
 * An amount that rolls to its new value in 360 ms (ux-v2/README.md §4), so an edit to a bill's lines is seen to change
 * the total. Under reduced motion the new value shows at once and nothing runs.
 */
export function RollingNumber({
  value,
  format,
}: {
  value: number;
  format: (value: number) => string;
}) {
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
