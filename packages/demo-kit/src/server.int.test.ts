// @vitest-environment node
import { mockMessage } from '@peera/db';
import { createTestDb, type TestDb } from '@peera/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEventStream, emitEvent, notify, type LiveEvent } from './server';

const tenantId = '00000000-0000-4000-8000-0000000000aa';
let testDb: TestDb;
let GET: (request: Request) => Promise<Response>;

beforeAll(async () => {
  testDb = await createTestDb();
  GET = createEventStream({
    getDb: () => testDb.db,
    getTenantId: async (request) =>
      request.headers.get('x-test-tenant') === 'none' ? null : tenantId,
    pollMs: 50,
    maxMs: 3000,
  });
});

afterAll(async () => {
  await testDb?.cleanup();
});

/** Reads SSE frames until `count` events arrived, then cancels the stream. */
async function readEvents(
  response: Response,
  count: number,
): Promise<LiveEvent[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: LiveEvent[] = [];
  let buffer = '';
  while (events.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = frame.split('\n').find((line) => line.startsWith('data: '));
      if (data) events.push(JSON.parse(data.slice(6)) as LiveEvent);
    }
  }
  await reader.cancel();
  return events;
}

describe('notify', () => {
  it('stores the mock message and an event pointing to it', async () => {
    const row = await notify(testDb.db, tenantId, {
      from: 'shop',
      text: 'ยืนยันการจองแล้ว',
    });
    const [stored] = await testDb.db
      .select()
      .from(mockMessage)
      .where(eq(mockMessage.id, row.id));
    expect(stored?.payload).toEqual({ from: 'shop', text: 'ยืนยันการจองแล้ว' });
  });
});

describe('createEventStream', () => {
  it('needs a session', async () => {
    const response = await GET(
      new Request('https://demo.test/api/events', {
        headers: { 'x-test-tenant': 'none' },
      }),
    );
    expect(response.status).toBe(401);
  });

  it('delivers an event inserted after the client connected', async () => {
    const lastId = await emitEvent(testDb.db, tenantId, 'warmup');
    const controller = new AbortController();
    const response = await GET(
      new Request('https://demo.test/api/events', {
        headers: { 'last-event-id': String(lastId) },
        signal: controller.signal,
      }),
    );
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reading = readEvents(response, 1);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await emitEvent(testDb.db, tenantId, 'booking.created', { booking: 'B-1' });
    const [received] = await reading;
    controller.abort();
    expect(received).toMatchObject({
      kind: 'booking.created',
      payload: { booking: 'B-1' },
    });
  });

  it('resumes after Last-Event-ID without repeating older events', async () => {
    const first = await emitEvent(testDb.db, tenantId, 'a');
    const second = await emitEvent(testDb.db, tenantId, 'b');
    const third = await emitEvent(testDb.db, tenantId, 'c');
    const controller = new AbortController();
    const response = await GET(
      new Request('https://demo.test/api/events', {
        headers: { 'last-event-id': String(first) },
        signal: controller.signal,
      }),
    );
    const events = await readEvents(response, 2);
    controller.abort();
    expect(events.map((item) => item.id)).toEqual([second, third]);
  });

  it('answers the polling fallback with JSON', async () => {
    const before = await emitEvent(testDb.db, tenantId, 'x');
    const after = await emitEvent(testDb.db, tenantId, 'y');
    const response = await GET(
      new Request(`https://demo.test/api/events?poll=1&after=${before}`),
    );
    const body = (await response.json()) as {
      events: LiveEvent[];
      lastId: number;
    };
    expect(body.events.map((item) => item.id)).toEqual([after]);
    expect(body.lastId).toBe(after);
  });
});
