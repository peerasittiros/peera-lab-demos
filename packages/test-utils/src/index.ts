import AxeBuilder from '@axe-core/playwright';
import { expect, type Frame, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export type Locale = 'th' | 'en';
export type Theme = 'light' | 'dark';
export type Variant = {
  locale: Locale;
  theme: Theme;
  width: 390 | 1280;
  name: string;
};

/** Every e2e flow runs in each language × theme × width (platform §8). */
export const variants: Variant[] = (['th', 'en'] as const).flatMap((locale) =>
  (['light', 'dark'] as const).flatMap((theme) =>
    ([390, 1280] as const).map((width) => ({
      locale,
      theme,
      width,
      name: `${locale} ${theme} ${width}`,
    })),
  ),
);

/**
 * Opens `/{locale}{path}` at the variant's width and theme. The theme travels as `?theme=`, the way the website
 * passes it to the iframe, so this also exercises the demo's theme script.
 */
export async function openVariant(
  page: Page,
  path: string,
  variant: Variant,
): Promise<void> {
  await page.setViewportSize({
    width: variant.width,
    height: variant.width === 390 ? 844 : 900,
  });
  const url = new URL(
    `/${variant.locale}${path}`,
    'http://placeholder.invalid',
  );
  url.searchParams.set('theme', variant.theme);
  await page.goto(`${url.pathname}${url.search}`);
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    variant.theme,
  );
  await expect(page.locator('html')).toHaveAttribute('lang', variant.locale);
}

/** Fails on serious or critical axe violations, listing them readably. */
export async function expectNoA11yViolations(
  page: Page,
  options: { exclude?: string[] } = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
  ]);
  for (const selector of options.exclude ?? [])
    builder = builder.exclude(selector);
  const { violations } = await builder.analyze();
  const serious = violations.filter(
    (violation) =>
      violation.impact === 'serious' || violation.impact === 'critical',
  );
  const report = serious.map(
    (violation) =>
      `${violation.impact} ${violation.id}: ${violation.help}\n  ${violation.nodes
        .slice(0, 5)
        .map((node) => node.target.join(' '))
        .join('\n  ')}`,
  );
  expect(report, report.join('\n')).toEqual([]);
}

export type EmbedOptions = {
  /** The demo app's origin, e.g. http://localhost:3010. */
  appOrigin: string;
  path: string;
  locale: Locale;
  theme: Theme;
};

/**
 * Opens the demo the way the website does: inside an iframe on another site, with `?embed=1&lang=…&theme=…` and
 * the website's sandbox. The host page comes from a real HTTP server on 127.0.0.1 with a random port (localhost
 * and 127.0.0.1 are different sites; a page faked with `route.fulfill` counts as public and trips Chrome's
 * local-network checks). The app must allow `http://127.0.0.1:*` in frame-ancestors. In dev the session cookie is
 * `SameSite=Lax`, so the browser never sends it to the cross-site frame: the app has to keep the session through
 * `?sid=` (platform §6.2). The server closes with the page.
 */
export async function openEmbedded(
  page: Page,
  options: EmbedOptions,
): Promise<Frame> {
  const src = new URL(`/${options.locale}${options.path}`, options.appOrigin);
  src.searchParams.set('embed', '1');
  src.searchParams.set('lang', options.locale);
  src.searchParams.set('theme', options.theme);
  const html = `<!doctype html><html lang="en"><head><title>Host</title></head><body style="margin:0">
<iframe id="demo" title="Demo" src="${src}" style="width:100%;height:100vh;border:0"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
  allow="camera; clipboard-write; fullscreen"></iframe></body></html>`;

  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  page.once('close', () => server.close());
  const { port } = server.address() as AddressInfo;

  await page.goto(`http://127.0.0.1:${port}/host`);
  const handle = await page.waitForSelector('#demo');
  const frame = await handle.contentFrame();
  if (!frame) throw new Error('demo iframe did not load');
  await frame.waitForLoadState('domcontentloaded');
  return frame;
}
