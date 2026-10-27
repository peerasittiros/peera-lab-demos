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

// 02 §10: staff never receive cost data in any server response. Staff start in a fresh browser (`?role=staff`), so
// nothing was fetched as the owner first; every response body (HTML, RSC, JSON) is checked for a money column.
test('staff receive no money columns in any server response', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const bodies: { url: string; text: string }[] = [];
  page.on('response', async (response) => {
    const type = response.headers()['content-type'] ?? '';
    // Data comes back as HTML, RSC or JSON; scripts only name the fields in code.
    if (!/json|html|text\/x-component/.test(type)) return;
    try {
      bodies.push({ url: response.url(), text: await response.text() });
    } catch {
      // A redirect or an aborted request has no body.
    }
  });
  await page.goto('/en?role=staff');
  await expect(
    page.getByRole('button', { name: /^Account: .*, Staff$/ }),
  ).toBeVisible();
  for (const path of [
    '/en/items',
    '/en/history',
    '/en/reorder',
    '/en/counts',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
  }
  const snapshot = bodies.find((body) =>
    body.url.includes('/api/demo/snapshot'),
  );
  expect(snapshot?.url).toContain('role=staff');
  const leaks = bodies
    .filter((body) =>
      /"(costSatang|priceSatang|unitCostSatang)"/.test(body.text),
    )
    .map((body) => body.url);
  expect(leaks).toEqual([]);
});
