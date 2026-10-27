import { expect, expectToast, setRole, test } from './fixtures';

// Items in the browser store (S6): the owner creates an item, finds it in the list, and staff see no cost column.

test('the owner creates an item, and it appears in the list and in quick move', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/items/new');
  await page.getByLabel(/Name in Thai/).fill('ทดสอบเพิ่มสินค้า');
  await page.getByLabel(/Name in English/).fill('Created in test');
  await page.getByRole('button', { name: 'Create item' }).click();
  await expectToast(page, /Item created/);
  await expect(page).toHaveURL(/\/en\/items\/[0-9a-f-]{36}(\?|$)/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Created in test',
  );

  await page.goto('/en/items');
  await page.getByRole('searchbox').fill('Created in test');
  await expect(
    page.getByRole('link', { name: 'Created in test' }).first(),
  ).toBeVisible();

  // Quick move finds it by name too, since both read the same store.
  await page.goto('/en');
  await page.getByRole('searchbox').fill('Created in test');
  await expect(
    page.getByRole('region', { name: 'Items' }).getByRole('button').first(),
  ).toContainText('Created in test');
});

// From 1280 px the table shows the owner-only stock value column; cost moved to the detail pane (V4).
test('staff do not see cost on the items list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  await setRole(page, 'owner');
  await page.goto('/en/items');
  await expect(
    page.getByRole('columnheader', { name: 'Stock value', exact: true }),
  ).toBeVisible();
  await setRole(page, 'staff');
  await page.goto('/en/items');
  await expect(
    page.getByRole('columnheader', { name: 'Stock value', exact: true }),
  ).toHaveCount(0);
});
