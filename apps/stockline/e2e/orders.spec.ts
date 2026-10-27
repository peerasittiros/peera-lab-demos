import { expect, expectToast, setRole, test } from './fixtures';

test('reorder → mark as ordered → receive in two deliveries', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await context
    .grantPermissions(['clipboard-read', 'clipboard-write'])
    .catch(() => undefined);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/reorder');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reorder');

  // Keep only the first supplier's items selected.
  const groups = page.locator('main section[lang]');
  const firstSupplier = (
    await groups.first().getByRole('heading', { level: 2 }).innerText()
  ).trim();
  const groupCount = await groups.count();
  for (let index = 1; index < groupCount; index += 1) {
    const toggle = groups
      .nth(index)
      .getByRole('checkbox', { name: /Select all from/ });
    if (
      (await toggle.getAttribute('aria-checked')) === 'true' ||
      (await toggle.getAttribute('data-state')) === 'checked'
    )
      await toggle.click();
  }
  const preview = page
    .getByRole('complementary')
    .filter({ hasText: 'Message preview' });
  await expect(preview.getByText(`To ${firstSupplier}`)).toBeVisible();
  await expect(preview.locator('pre').first()).toContainText(
    /Hello .*,\n.* would like to order the following:/,
  );

  await page.getByRole('button', { name: 'Send to LINE' }).click();
  await expectToast(page, /Message sent to/);
  await expect(
    page
      .getByRole('figure')
      .filter({ hasText: 'Preview of the message sent to LINE' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Mark as ordered' }).click();
  await page.waitForURL(/\/en\/orders/);
  await page.locator('main a[href*="/orders/"]').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('PO-');
  await expect(page.getByText(firstSupplier).first()).toBeVisible();

  // Staff receive the delivery: part of the first line, then the rest.
  await setRole(page, 'staff');
  await page.goBack();
  await page.reload();
  const firstInput = page
    .getByRole('textbox', { name: /Receiving now for/ })
    .first();
  await firstInput.fill('1');
  await page.getByRole('button', { name: 'Save received stock' }).click();
  await expectToast(page, /Received stock added/);
  await expect(page.getByText('Partly received').first()).toBeVisible();

  await page
    .getByRole('button', { name: 'Fill in everything remaining' })
    .click();
  await page.getByRole('button', { name: 'Save received stock' }).click();
  await expectToast(page, /Received stock added/);
  await expect(
    page.getByText('Received', { exact: true }).first(),
  ).toBeVisible();

  await page.goto('/en/history?type=in');
  await expect(
    page
      .locator('main')
      .getByText(/^PO-\d{4}$/)
      .first(),
  ).toBeVisible();
});
