'use client';

import { withSid, type SessionVia } from '@peera/db/session';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type DemoSessionValue = { token: string; via: SessionVia };
const DemoSessionContext = createContext<DemoSessionValue | null>(null);

/** The server passes the session it resolved in proxy.ts (`readDemoHeaders`). */
export function DemoSessionProvider({
  token,
  via,
  children,
}: DemoSessionValue & { children: ReactNode }) {
  return (
    <DemoSessionContext.Provider value={{ token, via }}>
      {children}
    </DemoSessionContext.Provider>
  );
}

/**
 * Keeps the session on links when the cookie may not be stored (platform §6.2): when the request didn't come with
 * the cookie, every internal href gets `?sid=<token>`. Once the cookie works, hrefs stay clean.
 */
export function useDemoHref(): (href: string) => string {
  const session = useContext(DemoSessionContext);
  return useCallback(
    (href: string) =>
      session && session.via !== 'cookie' ? withSid(href, session.token) : href,
    [session],
  );
}

/** True when the page was opened inside the website's iframe (`?embed=1`). Client-only; false on the server. */
export function useEmbedded(): boolean {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    setEmbedded(
      new URLSearchParams(window.location.search).get('embed') === '1',
    );
  }, []);
  return embedded;
}
