import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveEvents, type LiveEventMessage } from './live-events';

function Listener({ onEvent }: { onEvent: (event: LiveEventMessage) => void }) {
  useLiveEvents({ url: '/api/events', kinds: ['booking.created'], onEvent });
  return null;
}

const event = (id: number, kind = 'booking.created'): LiveEventMessage => ({
  id,
  kind,
  payload: { id },
  at: '2026-10-21T07:30:00Z',
});

describe('useLiveEvents polling fallback', () => {
  const realEventSource = globalThis.EventSource;

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no EventSource; make sure of it, so the hook falls back to polling.
    // @ts-expect-error removing the global for the test
    delete globalThis.EventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (realEventSource) globalThis.EventSource = realEventSource;
  });

  it('polls every 3 seconds from the last id and delivers only the wanted kinds', async () => {
    const urls: string[] = [];
    const responses = [
      { events: [event(1), event(2, 'other')] },
      { events: [event(3)] },
      { events: [] },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        return new Response(
          JSON.stringify(responses.shift() ?? { events: [] }),
        );
      }),
    );
    const onEvent = vi.fn();
    render(<Listener onEvent={onEvent} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onEvent.mock.calls.map(([item]) => item.id)).toEqual([1]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onEvent.mock.calls.map(([item]) => item.id)).toEqual([1, 3]);

    const params = urls.map((url) =>
      Object.fromEntries(new URL(url).searchParams),
    );
    expect(params[0]).toEqual({ poll: '1', after: '0' });
    expect(params[1]).toEqual({ poll: '1', after: '2' });
  });
});
