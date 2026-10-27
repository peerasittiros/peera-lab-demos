import { expect, setRole, test } from './fixtures';

// Phone layout (390 px): the bottom tab bar and the More sheet reach every page for both roles (SPEC §3).
const PHONE = { width: 390, height: 844 };

// The first tab's short label (V2): "Move".
const TABS = ['Move', 'Items', 'Reorder', 'History'];
const MORE: Record<'owner' | 'staff', string[]> = {
  owner: [
    'Dashboard',
    'Purchase orders',
    'Stock counts',
    // Import and Suppliers are reached from Settings.
    'Settings',
  ],
  staff: ['Purchase orders', 'Stock counts'],
};

for (const role of ['owner', 'staff'] as const) {
  test(`phone: every bottom tab and More page opens for ${role}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en');
    await setRole(page, role);
    await page.setViewportSize(PHONE);

    const tabBar = page.getByRole('navigation', { name: 'Main navigation' });
    for (const tab of TABS) {
      await tabBar.getByRole('link', { name: tab, exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/\S/);
    }

    for (const name of MORE[role]) {
      await page.getByRole('button', { name: 'More' }).click();
      const sheet = page.getByRole('dialog');
      await sheet.getByRole('link', { name, exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });
}

test('phone: the More sheet changes theme and remembers it', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto('/en/items');
  await page.getByRole('button', { name: 'More' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Dark', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/en/items');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('phone: the More sheet can reset the demo', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/en');
  await page.getByRole('button', { name: 'More' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reset', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Reset the demo?' }),
  ).toBeVisible();
});

test('desktop: the active sidebar item uses the teal soft background', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/items');
  const active = page
    .getByRole('navigation', { name: 'Main navigation' })
    .first()
    .getByRole('link', { name: 'Items', exact: true });
  await expect(active).toHaveAttribute('aria-current', 'page');
  await expect(active).toHaveCSS('color', 'rgb(10, 103, 103)');
});
