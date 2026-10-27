import { readFileSync } from 'node:fs';
import { expect, setRole, test } from './fixtures';

// History on the browser store (S9): URL filters, the CSV export (UTF-8 with BOM, no money columns for staff) and the
// owner dashboard reading the same numbers.

test('the history filters by type from the URL and exports a CSV', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/history?type=out');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('History');
  const shown = page.getByText(/^Showing \d+ of \d+/).first();
  await expect(shown).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    /^stockline-history-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const text = readFileSync((await file.path())!, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const header = text.split('\r\n')[0]!.slice(1);
  expect(header.startsWith('Time,SKU,Item,Type')).toBe(true);
  expect(header).toContain('Unit cost (baht)');
});

test('staff get the history without money columns', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  await setRole(page, 'staff');
  await page.goto('/en/history');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;
  const header = readFileSync((await file.path())!, 'utf8').split('\r\n')[0]!;
  expect(header).not.toContain('baht');
});

test('the owner dashboard shows its KPIs and the order preview', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  await setRole(page, 'owner');
  await page.goto('/en/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  await expect(page.getByText('Stock value at cost').first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'To order this week' }),
  ).toBeVisible();
});
