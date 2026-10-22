'use client';

import { useEffect, useRef } from 'react';

export type LiveEventMessage = {
  id: number;
  kind: string;
  payload: unknown;
  at: string;
};

export type UseLiveEventsOptions = {
  /** The app's event route, e.g. `/api/events` (with `?sid=` when the cookie isn't stored: use `useDemoHref`). */
  url: string;
  /** Event kinds to receive, e.g. `['mock_message', 'booking.created']`. */
  kinds: string[];
  onEvent: (event: LiveEventMessage) => void;
  pollMs?: number;
};

function withParams(url: string, params: Record<string, string>): string {
  const target = new URL(url, window.location.href);
  for (const [key, value] of Object.entries(params))
    target.searchParams.set(key, value);
  return target.toString();
}

/**
 * Live tenant events. Uses EventSource (which reconnects by itself, resuming with Last-Event-ID); when EventSource
 * is missing or the stream keeps failing, falls back to polling `?poll=1&after=<id>` every 3 seconds.
 */
export function useLiveEvents({
  url,
  kinds,
  onEvent,
  pollMs = 3000,
}: UseLiveEventsOptions): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const kindsKey = kinds.join(',');

  useEffect(() => {
    const wanted = new Set(kindsKey.split(',').filter(Boolean));
    let lastId = 0;
    let stopped = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let source: EventSource | undefined;

    const deliver = (item: LiveEventMessage) => {
      if (item.id <= lastId) return;
      lastId = item.id;
      if (wanted.has(item.kind)) handler.current(item);
    };

    const poll = async () => {
      if (stopped) return;
      try {
        const response = await fetch(
          withParams(url, { poll: '1', after: String(lastId) }),
          {
            headers: { accept: 'application/json' },
          },
        );
        if (response.ok) {
          const body = (await response.json()) as {
            events: LiveEventMessage[];
          };
          body.events.forEach(deliver);
        }
      } catch {
        // Offline for a moment: try again on the next tick.
      }
      if (!stopped) pollTimer = setTimeout(poll, pollMs);
    };

    if (typeof EventSource === 'undefined') {
      void poll();
    } else {
      let failures = 0;
      source = new EventSource(url);
      const listener = (message: MessageEvent<string>) => {
        failures = 0;
        deliver(JSON.parse(message.data) as LiveEventMessage);
      };
      for (const kind of wanted)
        source.addEventListener(kind, listener as EventListener);
      source.onerror = () => {
        failures += 1;
        // The normal ~55 s close also fires `error`; give up on SSE only after repeated failures.
        if (failures >= 3 && source) {
          source.close();
          source = undefined;
          void poll();
        }
      };
    }

    return () => {
      stopped = true;
      source?.close();
      clearTimeout(pollTimer);
    };
  }, [url, kindsKey, pollMs]);
}
