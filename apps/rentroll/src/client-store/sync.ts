import type { Op } from './ops';

/**
 * Keeps other tabs of the same browser in step (SPEC §2.2). Each tab writes its ops to IndexedDB and posts them here;
 * the other tabs apply them in memory without writing them again. Without BroadcastChannel this is a no-op.
 */
export type Sync = {
  post(op: Op): void;
  close(): void;
};

const CHANNEL = 'rentroll';

type Message = { type: 'op'; op: Op };

export function openSync(onRemoteOp: (op: Op) => void): Sync | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<Message>) => {
    if (event.data?.type === 'op') onRemoteOp(event.data.op);
  };
  return {
    post(op) {
      channel.postMessage({ type: 'op', op } satisfies Message);
    },
    close() {
      channel.close();
    },
  };
}
