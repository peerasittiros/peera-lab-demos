import { describe, expect, it } from 'vitest';
import {
  readSession,
  resolveDemoSession,
  sessionCookie,
  signSid,
  verifySid,
  withSid,
} from './session';

const secret = 'test-secret-that-is-at-least-32-characters';
const sid = '3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3e';

describe('signed session id', () => {
  it('round-trips a signed id', async () => {
    expect(await verifySid(await signSid(sid, secret), secret)).toBe(sid);
  });

  it('rejects a tampered value, a wrong secret and an unsigned id', async () => {
    const token = await signSid(sid, secret);
    const otherSid = '3f2b8c1e-4d5a-4b6c-9d7e-8f9a0b1c2d3f';
    expect(
      await verifySid(`${otherSid}${token.slice(sid.length)}`, secret),
    ).toBeNull();
    expect(await verifySid(`${token.slice(0, -2)}xx`, secret)).toBeNull();
    expect(await verifySid(token, `${secret}-other`)).toBeNull();
    expect(await verifySid(sid, secret)).toBeNull();
    expect(await verifySid('', secret)).toBeNull();
  });
});

describe('sessionCookie', () => {
  it('is a partitioned third-party cookie in production', () => {
    expect(sessionCookie('t', { secure: true })).toBe(
      'demo_sid=t; Path=/; Max-Age=172800; HttpOnly; Secure; SameSite=None; Partitioned',
    );
  });

  it('drops Secure and Partitioned over http in dev', () => {
    expect(sessionCookie('t', { secure: false })).toBe(
      'demo_sid=t; Path=/; Max-Age=172800; HttpOnly; SameSite=Lax',
    );
  });
});

describe('readSession and resolveDemoSession', () => {
  it('reads the cookie first, then a signed ?sid', async () => {
    const token = await signSid(sid, secret);
    const viaCookie = new Request('https://demo.test/th', {
      headers: { cookie: `other=1; demo_sid=${token}` },
    });
    expect(await readSession(viaCookie, secret)).toEqual({
      sid,
      token,
      via: 'cookie',
    });

    const viaQuery = new Request(
      `https://demo.test/th?sid=${encodeURIComponent(token)}`,
    );
    expect(await readSession(viaQuery, secret)).toMatchObject({
      sid,
      via: 'query',
    });

    expect(
      await readSession(new Request(`https://demo.test/th?sid=${sid}`), secret),
    ).toBeNull();
  });

  it('creates a new session with a cookie when none is valid', async () => {
    const session = await resolveDemoSession(
      new Request('https://demo.test/th'),
      {
        secret,
        secure: true,
      },
    );
    expect(session.via).toBe('new');
    expect(await verifySid(session.token, secret)).toBe(session.sid);
    expect(session.setCookie).toContain(`demo_sid=${session.token}`);
  });

  it('re-sets the cookie for a ?sid session but not for a cookie session', async () => {
    const token = await signSid(sid, secret);
    const fromQuery = await resolveDemoSession(
      new Request(`https://demo.test/th?sid=${token}`),
      { secret, secure: false },
    );
    expect(fromQuery).toMatchObject({ sid, via: 'query' });
    expect(fromQuery.setCookie).toContain(token);

    const fromCookie = await resolveDemoSession(
      new Request('https://demo.test/th', {
        headers: { cookie: `demo_sid=${token}` },
      }),
      { secret, secure: false },
    );
    expect(fromCookie.setCookie).toBeUndefined();
  });
});

describe('withSid', () => {
  it('adds sid to relative and absolute links, keeping query and hash', () => {
    expect(withSid('/th/items?q=1#top', 'abc.def')).toBe(
      '/th/items?q=1&sid=abc.def#top',
    );
    expect(withSid('https://demo.test/en', 'abc.def')).toBe(
      'https://demo.test/en?sid=abc.def',
    );
  });
});
