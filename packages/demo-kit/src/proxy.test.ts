// @vitest-environment node
import { signSid } from '@peera/db/session';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { createDemoProxy, readDemoHeaders } from './proxy';

const secret = 'test-secret-that-is-at-least-32-characters';
const proxy = createDemoProxy({ secret: () => secret });

describe('createDemoProxy', () => {
  it('redirects a URL without a locale, keeping ?sid', async () => {
    const response = await proxy(
      new NextRequest('https://demo.test/items?sid=abc.def'),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://demo.test/th/items?sid=abc.def',
    );
  });

  it('creates a session, sets a partitioned cookie on https and passes it to the app as headers', async () => {
    const response = await proxy(new NextRequest('https://demo.test/th/items'));
    expect(response.headers.get('set-cookie')).toMatch(
      /^demo_sid=[^;]+; .*SameSite=None; Partitioned$/,
    );
    expect(response.headers.get('x-middleware-request-x-demo-sid-via')).toBe(
      'new',
    );
    expect(response.headers.get('x-middleware-request-x-demo-sid')).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it('uses a valid cookie without re-setting it and ignores forged headers', async () => {
    const sid = '3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3e';
    const token = await signSid(sid, secret);
    const response = await proxy(
      new NextRequest('http://localhost:3001/en', {
        headers: { cookie: `demo_sid=${token}`, 'x-demo-sid': 'forged' },
      }),
    );
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-demo-sid')).toBe(sid);
    expect(response.headers.get('x-middleware-request-x-demo-sid-via')).toBe(
      'cookie',
    );
  });
});

describe('readDemoHeaders', () => {
  it('reads the session the proxy attached', () => {
    const headers = new Headers({
      'x-demo-sid': 's',
      'x-demo-sid-token': 't',
      'x-demo-sid-via': 'query',
    });
    expect(readDemoHeaders(headers)).toEqual({
      sid: 's',
      token: 't',
      via: 'query',
    });
    expect(readDemoHeaders(new Headers())).toBeNull();
  });
});
