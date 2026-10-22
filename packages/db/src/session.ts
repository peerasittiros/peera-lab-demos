// Demo session transport (platform §6.2). Web Crypto only, so it runs in proxy.ts, Route Handlers and Server
// Components alike. The session id is a random UUID with no personal data; it travels signed, as
// `<uuid>.<hmac>`, in the `demo_sid` cookie or, when the browser drops third-party cookies, in `?sid=`.

export const SESSION_COOKIE = 'demo_sid';
export const SESSION_PARAM = 'sid';
/** Two days: cleanup removes the tenant after 24 h (a daily cron), so a session can't outlive ~48 h anyway. */
const MAX_AGE_SECONDS = 2 * 24 * 60 * 60;

const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function hmacKey(secret: string, usage: 'sign' | 'verify') {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

/** `<sid>.<signature>`: the value stored in the cookie or the `?sid=` parameter. */
export async function signSid(sid: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret, 'sign'),
    encoder.encode(sid),
  );
  return `${sid}.${base64url(signature)}`;
}

/** The session id if the token is well formed and correctly signed, else null (constant-time check). */
export async function verifySid(
  token: string | null | undefined,
  secret: string,
): Promise<string | null> {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const sid = token.slice(0, dot);
  const signature = fromBase64url(token.slice(dot + 1));
  if (!UUID.test(sid) || !signature) return null;
  const ok = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret, 'verify'),
    signature,
    encoder.encode(sid),
  );
  return ok ? sid : null;
}

/**
 * The `Set-Cookie` value. In production the demo is framed cross-site, so the cookie is third-party:
 * `SameSite=None; Secure; Partitioned` (CHIPS). Over plain http in dev, `Secure` would drop it, so it is `Lax`.
 */
export function sessionCookie(
  token: string,
  { secure }: { secure: boolean },
): string {
  const base = `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly`;
  return secure
    ? `${base}; Secure; SameSite=None; Partitioned`
    : `${base}; SameSite=Lax`;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export type SessionVia = 'cookie' | 'query' | 'new';
export type DemoSessionRef = { sid: string; token: string; via: SessionVia };

/** The session from the signed cookie, else from a signed `?sid=`. Unsigned or tampered values are ignored. */
export async function readSession(
  request: Request,
  secret: string,
): Promise<DemoSessionRef | null> {
  const cookieToken = readCookie(request.headers.get('cookie'), SESSION_COOKIE);
  const fromCookie = await verifySid(cookieToken, secret);
  if (fromCookie && cookieToken)
    return { sid: fromCookie, token: cookieToken, via: 'cookie' };

  const queryToken = new URL(request.url).searchParams.get(SESSION_PARAM);
  const fromQuery = await verifySid(queryToken, secret);
  if (fromQuery && queryToken)
    return { sid: fromQuery, token: queryToken, via: 'query' };
  return null;
}

/**
 * For proxy.ts: the visitor's session, or a new one. `setCookie` is set whenever the request didn't arrive with a
 * valid cookie. When `via` is not `cookie`, pages put `?sid=<token>` on their links (`withSid`), so the session
 * survives browsers that block the cookie; once the cookie comes back, links drop it.
 */
export async function resolveDemoSession(
  request: Request,
  { secret, secure }: { secret: string; secure: boolean },
): Promise<DemoSessionRef & { setCookie?: string }> {
  const existing = await readSession(request, secret);
  if (existing?.via === 'cookie') return existing;
  const session = existing ?? {
    sid: crypto.randomUUID(),
    token: '',
    via: 'new' as const,
  };
  const token = session.token || (await signSid(session.sid, secret));
  return { ...session, token, setCookie: sessionCookie(token, { secure }) };
}

/** Adds `?sid=<token>` to an app-relative or absolute href, keeping its query and hash. */
export function withSid(href: string, token: string): string {
  const url = new URL(href, 'http://local.invalid');
  url.searchParams.set(SESSION_PARAM, token);
  return href.startsWith('http')
    ? url.toString()
    : `${url.pathname}${url.search}${url.hash}`;
}
