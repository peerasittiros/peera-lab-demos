'use client';

import { cn } from '@peera/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const WIDTH = 390;
const HEIGHT = 844;

/**
 * A 390×844 phone viewport, scaled down to fit its container. A plain outline, no device brand. The content lays
 * out at real phone width, so customer-facing pages look exactly as on a phone.
 */
export function PhoneFrame({
  label,
  children,
  className,
}: {
  /** Accessible name, e.g. "Customer's phone" in the active language. */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = outer.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(Math.min(1, entry.contentRect.width / WIDTH));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={outer}
      role="group"
      aria-label={label}
      // overflow-hidden: a transform doesn't shrink the layout box, so the unscaled 390px would widen the page.
      className={cn('mx-auto w-full max-w-[390px] overflow-hidden', className)}
      style={{ height: HEIGHT * scale }}
    >
      <div
        className="overflow-hidden rounded-lg border-2 border-line-strong bg-surface shadow-lift"
        style={{
          width: WIDTH,
          height: HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <div className="h-full overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
