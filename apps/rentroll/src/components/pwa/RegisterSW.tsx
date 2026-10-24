'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (SPEC §6). Only in production, and only in the top window: inside the website's frame
 * the worker would be scoped to the website's origin, so the frame skips it.
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (window.top !== window.self) return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
