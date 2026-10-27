import type { Op } from './ops';

// Keeps other tabs of the same browser in step: a tab that records an op posts it, and the others apply it.

export type SyncMessage = { type: 'op'; op: Op } | { type: 'reset' };

export type SyncChannel = {
  post(message: SyncMessage): void;
  close(): void;
};

/** A BroadcastChannel, or null where the browser has none (the tab then works alone). */
export function openSyncChannel(
  onMessage: (message: SyncMessage) => void,
  name = 'stockline',
): SyncChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const channel = new BroadcastChannel(name);
  channel.onmessage = (event: MessageEvent<SyncMessage>) =>
    onMessage(event.data);
  return {
    post: (message) => channel.postMessage(message),
    close: () => channel.close(),
  };
}
