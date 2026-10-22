export const locales = ['th', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'th';

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'th' || value === 'en';
}

type LocalePreferences = {
  query?: string | URLSearchParams | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
};

function queryLocale(query: LocalePreferences['query']): Locale | undefined {
  const params =
    query instanceof URLSearchParams
      ? query
      : query
        ? new URLSearchParams(query.startsWith('?') ? query.slice(1) : query)
        : null;
  const value = params?.get('lang');
  return isLocale(value) ? value : undefined;
}

function cookieLocale(cookie: string | null | undefined): Locale | undefined {
  if (!cookie) return undefined;
  const pair = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('locale='));
  const value = pair?.slice('locale='.length);
  return isLocale(value) ? value : undefined;
}

function acceptedLocale(header: string | null | undefined): Locale | undefined {
  if (!header) return undefined;
  const candidates = header.split(',').map((entry, index) => {
    const [tag = '', ...parameters] = entry.trim().split(';');
    const qualityParameter = parameters.find((parameter) =>
      parameter.trim().startsWith('q='),
    );
    const parsedQuality = qualityParameter
      ? Number(qualityParameter.trim().slice(2))
      : 1;
    const quality =
      Number.isFinite(parsedQuality) && parsedQuality >= 0 && parsedQuality <= 1
        ? parsedQuality
        : 0;
    return { tag: tag.trim().toLowerCase(), quality, index };
  });

  candidates.sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { tag, quality } of candidates) {
    if (quality <= 0) continue;
    const language = tag.split('-')[0];
    if (isLocale(language)) return language;
  }
  return undefined;
}

/** Resolve locale in platform order: query, cookie, Accept-Language, then Thai. */
export function resolveLocale({
  query,
  cookie,
  acceptLanguage,
}: LocalePreferences): Locale {
  return (
    queryLocale(query) ??
    cookieLocale(cookie) ??
    acceptedLocale(acceptLanguage) ??
    defaultLocale
  );
}

/** Return a standard Web handler that redirects unprefixed requests to /{locale}/… . */
export function createLocaleProxy() {
  return function localeProxy(request: Request): Response | null {
    const url = new URL(request.url);
    if (/^\/(?:th|en)(?:\/|$)/.test(url.pathname)) return null;

    const query = url.searchParams;
    const locale = resolveLocale({
      query,
      cookie: request.headers.get('cookie'),
      acceptLanguage: request.headers.get('accept-language'),
    });
    const hadQueryLocale = isLocale(query.get('lang'));
    const redirectUrl = new URL(url);
    redirectUrl.pathname = `/${locale}${url.pathname === '/' ? '' : url.pathname}`;

    const headers = new Headers({ location: redirectUrl.toString() });
    if (hadQueryLocale) {
      headers.append(
        'set-cookie',
        `locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${url.protocol === 'https:' ? '; Secure' : ''}`,
      );
    }
    return new Response(null, { status: 307, headers });
  };
}
