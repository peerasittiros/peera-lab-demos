import {
  resolveDemoSession,
  type DemoSessionRef,
  type SessionVia,
} from '@peera/db/session';
import { createLocaleProxy } from '@peera/i18n';
import { NextResponse, type NextRequest } from 'next/server';

const SID = 'x-demo-sid';
const TOKEN = 'x-demo-sid-token';
const VIA = 'x-demo-sid-via';

/**
 * Each app's `proxy.ts`: `export default createDemoProxy({ secret: () => env.DEMO_SESSION_SECRET })`.
 * 1. URLs without a locale redirect to `/{locale}/…` (query, incl. `?sid`, kept).
 * 2. The visitor's session is read from the cookie or `?sid`, or created; the cookie is (re)set when needed.
 * 3. The session reaches Server Components and Server Actions as request headers (`readDemoHeaders`). Incoming
 *    headers with those names are always overwritten, so a visitor can't forge them.
 */
export function createDemoProxy({
  secret,
  secure,
}: {
  secret: () => string | undefined;
  secure?: boolean;
}) {
  const localeProxy = createLocaleProxy();
  return async function proxy(request: NextRequest): Promise<Response> {
    const redirect = localeProxy(request);
    if (redirect) return redirect;

    const key = secret();
    if (!key) throw new Error('DEMO_SESSION_SECRET is not set');
    const session = await resolveDemoSession(request, {
      secret: key,
      secure: secure ?? request.nextUrl.protocol === 'https:',
    });
    const headers = new Headers(request.headers);
    headers.set(SID, session.sid);
    headers.set(TOKEN, session.token);
    headers.set(VIA, session.via);
    const response = NextResponse.next({ request: { headers } });
    if (session.setCookie)
      response.headers.append('set-cookie', session.setCookie);
    return response;
  };
}

/** The session proxy.ts attached, from `await headers()` in server code. Null outside the proxy's matcher. */
export function readDemoHeaders(headers: Headers): DemoSessionRef | null {
  const sid = headers.get(SID);
  const token = headers.get(TOKEN);
  const via = headers.get(VIA) as SessionVia | null;
  return sid && token && via ? { sid, token, via } : null;
}
