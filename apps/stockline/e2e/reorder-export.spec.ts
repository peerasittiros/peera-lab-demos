import { expect, test } from './fixtures';

// The reorder list exports to CSV in the browser: UTF-8 with a BOM, the file name carries the Bangkok date, and the
// supplier column is first.

test('the reorder list downloads as CSV with a BOM and the supplier column first', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/reorder');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    /^stockline-reorder-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const path = await file.path();
  const { readFileSync } = await import('node:fs');
  const text = readFileSync(path!, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text.split('\r\n')[0]?.slice(1)).toMatch(/^Supplier,SKU,Item,/);
});
