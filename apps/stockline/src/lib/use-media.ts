'use client';

import { useSyncExternalStore } from 'react';

/** Whether a media query matches, kept in sync with the window. False on the server and in the first render. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
