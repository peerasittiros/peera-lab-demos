import { expect, setRole, test } from './fixtures';

const ROUTES = [
  '',
  '/dashboard',
  '/items',
  '/items/new',
  '/items/labels',
  '/reorder',
  '/orders',
  '/counts',
  '/history',
  '/import',
  '/suppliers',
  '/settings',
];

test('every route renders with one h1 in both languages', async ({ page }) => {
  test.setTimeout(180_000);
  for (const locale of ['th', 'en'] as const) {
    for (const route of ROUTES) {
      const response = await page.goto(`/${locale}${route}`);
      expect(response?.status(), `${locale}${route}`).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('h1'), `${locale}${route}`).toHaveCount(1);
    }
  }
});

test('detail routes render from the list pages', async ({ page }) => {
  await page.goto('/en/items');
  await page
    .locator('main a[href*="/items/"]')
    .filter({ hasNotText: /labels|Add item/ })
    .first()
    .click();
  // From 1280 the name opens the detail pane; the pane links to the full page.
  await page.getByRole('link', { name: 'Open the item page' }).click();
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
  await page.goto('/en/orders');
  await page.locator('main a[href*="/orders/"]').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('PO-');
  await page.goto('/en/counts');
  await page.locator('main a[href*="/counts/"]').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('CNT-');
});

test('the role switch changes the landing page and staff are kept out of owner pages', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Quick move',
  );
  await setRole(page, 'staff');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Quick move',
  );
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .first()
      .getByRole('link', { name: 'Dashboard' }),
  ).toHaveCount(0);
  await page.goto('/en/dashboard');
  await expect(page).toHaveURL(/\/en(\?|$)/);
  await setRole(page, 'owner');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
});

test('sends the frame-ancestors policy', async ({ request }) => {
  const response = await request.get('/th');
  expect(response.headers()['content-security-policy']).toMatch(
    /frame-ancestors 'self'/,
  );
});

test('a URL without a locale redirects, keeping the query', async ({
  page,
}) => {
  await page.goto('/items?theme=dark');
  await expect(page).toHaveURL(/\/(th|en)\/items\?theme=dark/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
