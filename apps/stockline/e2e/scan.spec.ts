import { openEmbedded } from '@peera/test-utils';
import { expect, test } from './fixtures';

test('"Scan a sample" opens the scanned item, ready to record', async ({
  page,
}) => {
  await page.goto('/en');
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const scanner = page.getByRole('dialog', { name: 'Scan a barcode' });
  await expect(scanner).toBeVisible();
  await scanner.getByRole('button', { name: 'Scan a sample' }).click();
  await expect(page.getByRole('button', { name: 'Save In' })).toBeVisible({
    timeout: 15_000,
  });
});

test('a typed unknown code offers to create an item with it', async ({
  page,
}) => {
  await page.goto('/en');
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const scanner = page.getByRole('dialog', { name: 'Scan a barcode' });
  await scanner.getByLabel('Type the code').fill('9990000000005');
  await scanner.getByRole('button', { name: 'Find' }).click();
  await expect(
    scanner.getByText('No item has the code 9990000000005.'),
  ).toBeVisible();
  await scanner
    .getByRole('link', { name: 'Create an item with this barcode' })
    .click();
  await expect(page.getByLabel(/Barcode/)).toHaveValue('9990000000005');
});

test('without camera access the scanner explains and still takes a typed code', async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  await page.goto('/th');
  await page.getByRole('button', { name: 'สแกน', exact: true }).click();
  const scanner = page.getByRole('dialog', { name: 'สแกนบาร์โค้ด' });
  await expect(
    scanner.getByRole('status').filter({ hasText: /กล้อง|บาร์โค้ด/ }),
  ).toBeVisible({ timeout: 15_000 });
  await scanner.getByLabel('พิมพ์รหัสเอง').fill('STK-0001');
  await scanner.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(page.getByRole('button', { name: 'บันทึกรับเข้า' })).toBeVisible(
    { timeout: 15_000 },
  );
});

test('inside the website iframe, a blocked camera points to "open in a new tab"', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'WebKit has no camera permission model in headless mode',
  );
  await context.clearPermissions();
  const frame = await openEmbedded(page, {
    appOrigin: 'http://localhost:3011',
    path: '',
    locale: 'en',
    theme: 'light',
  });
  await frame.getByRole('button', { name: 'Scan', exact: true }).click();
  const scanner = frame.getByRole('dialog', { name: 'Scan a barcode' });
  await expect(
    scanner.getByText(
      /Open in a new tab to use the camera|camera is not available|cannot read barcodes/,
    ),
  ).toBeVisible({
    timeout: 15_000,
  });
});
