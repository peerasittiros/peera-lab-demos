import { expect, expectToast, setRole, test } from './fixtures';

// Settings, grouped into pages (owner only): the phone list and back link, the desktop side nav, reordering and
// renaming categories, a shop logo and an item photo kept in the browser, people's names, suppliers.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
/** A 1 × 1 PNG: the browser crops, scales and re-encodes it like any photo. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const picture = { name: 'photo.png', mimeType: 'image/png', buffer: PNG };

test('phone: the settings list opens a page, and its back link returns', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto('/en/settings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  // The app has hydrated and loaded the shop (its logo shows) before the first tap, as a person would wait.
  await expect(page.getByRole('img', { name: /^Shop logo/ })).toBeVisible();
  await page.getByRole('link', { name: /^Categories/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Categories',
  );
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
});

test('desktop: the side nav marks the open page', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/en/settings/units');
  const nav = page.getByRole('navigation', { name: 'Settings' });
  await expect(nav.getByRole('link', { name: 'Units' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(
    nav.getByRole('link', { name: 'Categories' }),
  ).not.toHaveAttribute('aria-current');
});

test('categories: rename one and move it, and both survive a reload', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/en/settings/categories');
  const rows = page.locator('main ol > li');
  await expect(rows.first()).toBeVisible();
  const first = (
    await rows.nth(0).locator('.text-ink').first().innerText()
  ).trim();

  await page.getByRole('button', { name: `Edit ${first}` }).click();
  const editing = rows.filter({
    has: page.getByRole('button', { name: 'Save' }),
  });
  await editing.getByLabel('Thai').fill('เครื่องดื่มเย็น');
  await editing.getByLabel(/English/).fill('Cold drinks');
  await editing.getByRole('button', { name: 'Save' }).click();
  await expectToast(page, 'Saved');

  await page.getByRole('button', { name: 'Move Cold drinks down' }).click();
  await expect(page.getByText('Cold drinks is now number 2')).toBeAttached();
  await expect(
    page.getByRole('button', { name: 'Move Cold drinks down' }),
  ).toBeFocused();

  await page.reload();
  await expect(rows.nth(1)).toContainText('Cold drinks');
});

test('a shop logo is stored in the browser and shown in the sidebar', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/en/settings/shop');
  await page.locator('input[type="file"]').setInputFiles(picture);
  await expect(page.getByRole('img', { name: 'Chosen picture' })).toBeVisible();
  await page.getByRole('button', { name: 'Save shop settings' }).click();
  await expectToast(page, 'Settings saved');
  const logo = page.locator('aside img').first();
  await expect(logo).toHaveAttribute('src', /^data:image\/(webp|jpeg);base64,/);
});

test('an item photo is added on the item form', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/en/items/new');
  await page.locator('input[type="file"]').setInputFiles(picture);
  await expect(page.getByRole('img', { name: 'Chosen picture' })).toBeVisible();
  await page.getByLabel(/Name in Thai/).fill('สินค้ามีรูป');
  await page.getByRole('button', { name: 'Create item' }).click();
  await expectToast(page, 'Item created');
  await expect(
    page.locator('main img[src^="data:image/"]').first(),
  ).toBeVisible();
});

test('people: renaming staff shows on the account menu', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/en/settings/users');
  const staff = page.locator('form').filter({ hasText: 'Staff' });
  await staff.getByLabel('Display name').fill('May');
  await staff.getByRole('button', { name: 'Save' }).click();
  await expectToast(page, 'Name saved');
  await setRole(page, 'staff');
  await expect(
    page.getByRole('button', { name: /^Account: May, Staff$/ }),
  ).toBeVisible();
});

test('suppliers: an unused one can be removed, a used one cannot', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/en/settings/suppliers');
  await page.getByRole('button', { name: 'Add supplier' }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/Supplier name/)
    .fill('Test Wholesale');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expectToast(page, 'Supplier saved');

  await page
    .getByRole('button', { name: 'Edit Test Wholesale' })
    .first()
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remove' })
    .click();
  await expectToast(page, 'Removed');
  await expect(page.getByText('Test Wholesale')).toHaveCount(0);

  await page
    .getByRole('button', { name: /^Edit / })
    .first()
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remove' })
    .click();
  // The reason shows inside the sheet (behind it, the toasts are hidden from screen readers).
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'cannot be removed',
  );
});

test('staff are kept out of settings, and /suppliers redirects', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/en/suppliers');
  await expect(page).toHaveURL(/\/en\/settings\/suppliers/);
  await setRole(page, 'staff');
  await page.goto('/en/settings/shop');
  await expect(page).toHaveURL(/\/en(\?|$)/);
});
