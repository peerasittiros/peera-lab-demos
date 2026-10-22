// Server-only helpers (Route Handlers, Server Actions). Import from '@peera/demo-kit/server'.
import { event, mockMessage, type Db, type Queryable } from '@peera/db';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { ChatMessage } from './LineChatMock';

export { createDemoProxy, readDemoHeaders } from './proxy';
export { frameHeaders } from './headers';

export type MockMessagePayload = Omit<ChatMessage, 'id' | 'at'>;

/**
 * Records a message the real system would send (LINE push, reminder…) for `LineChatMock`, and an event so open
 * pages update live. Demos never send real messages (platform §6.3).
 */
export async function notify(
  db: Queryable,
  tenantId: string,
  message: MockMessagePayload,
  channel = 'line',
) {
  const [row] = await db
    .insert(mockMessage)
    .values({ tenantId, channel, payload: message })
    .returning();
  await db
    .insert(event)
    .values({
      tenantId,
      kind: 'mock_message',
      payload: { id: row!.id, channel },
    });
  return row!;
}

/** Writes a tenant event (e.g. `booking.created`) for the live views. */
export async function emitEvent(
  db: Queryable,
  tenantId: string,
  kind: string,
  payload: Record<string, unknown> = {},
) {
  const [row] = await db
    .insert(event)
    .values({ tenantId, kind, payload })
    .returning({ id: event.id });
  return row!.id;
}

export type LiveEvent = {
  id: number;
  kind: string;
  payload: unknown;
  at: string;
};

async function eventsAfter(
  db: Db,
  tenantId: string,
  after: number,
): Promise<LiveEvent[]> {
  const rows = await db
    .select()
    .from(event)
    .where(and(eq(event.tenantId, tenantId), gt(event.id, after)))
    .orderBy(asc(event.id))
    .limit(100);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    at: row.at.toISOString(),
  }));
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

export type EventStreamOptions = {
  getDb: () => Db;
  /** The visitor's tenant for this request, or null (→ 401). */
  getTenantId: (request: Request) => Promise<string | null>;
  pollMs?: number;
  /** Close before the serverless time limit; EventSource reconnects with Last-Event-ID. */
  maxMs?: number;
};

/**
 * `GET /api/events` for an app. Default: a Server-Sent Events stream that checks `platform.event` for the tenant
 * every second (`id > Last-Event-ID`) and closes after ~55 s. With `?poll=1&after=<id>` it answers JSON once,
 * for the 3-second polling fallback.
 */
export function createEventStream({
  getDb,
  getTenantId,
  pollMs = 1000,
  maxMs = 55_000,
}: EventStreamOptions) {
  return async function GET(request: Request): Promise<Response> {
    const tenantId = await getTenantId(request);
    if (!tenantId)
      return Response.json({ error: 'no session' }, { status: 401 });
    const url = new URL(request.url);
    const db = getDb();
    const startAfter =
      Number(
        request.headers.get('last-event-id') ??
          url.searchParams.get('after') ??
          0,
      ) || 0;

    if (url.searchParams.get('poll') === '1') {
      const events = await eventsAfter(db, tenantId, startAfter);
      return Response.json({ events, lastId: events.at(-1)?.id ?? startAfter });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const stop = AbortSignal.any([
          request.signal,
          AbortSignal.timeout(maxMs),
        ]);
        let lastId = startAfter;
        controller.enqueue(encoder.encode('retry: 3000\n\n'));
        try {
          while (!stop.aborted) {
            for (const item of await eventsAfter(db, tenantId, lastId)) {
              lastId = item.id;
              controller.enqueue(
                encoder.encode(
                  `id: ${item.id}\nevent: ${item.kind}\ndata: ${JSON.stringify(item)}\n\n`,
                ),
              );
            }
            await sleep(pollMs, stop);
          }
        } catch (error) {
          console.error('[events] stream failed', error);
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed by the client.
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    });
  };
}
