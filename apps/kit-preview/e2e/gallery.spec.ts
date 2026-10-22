import {
  expectNoA11yViolations,
  openEmbedded,
  openVariant,
  variants,
} from '@peera/test-utils';
import { expect, test } from '@playwright/test';

for (const variant of variants) {
  test(`gallery: ${variant.name}`, async ({ page, browserName }, testInfo) => {
    await openVariant(page, '', variant);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('main')).toHaveAttribute('lang', variant.locale);
    // No horizontal scroll at any width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoA11yViolations(page);
    await page.screenshot({
      path: testInfo.outputPath(
        `gallery-${browserName}-${variant.locale}-${variant.theme}-${variant.width}.png`,
      ),
      fullPage: true,
    });
  });
}

test('overlays open, trap focus and close with Escape', async ({ page }) => {
  await openVariant(page, '', {
    locale: 'th',
    theme: 'light',
    width: 1280,
    name: 'th light 1280',
  });
  await page.getByRole('button', { name: 'เปิดหน้าต่าง' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'รับสินค้าตามใบสั่งซื้อนี้ไหม',
  });
  await expect(dialog).toBeVisible();
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'เปิดหน้าต่าง' }),
  ).toBeFocused();
});

test('the demo bar folds into a menu on a phone', async ({ page }) => {
  await openVariant(page, '', {
    locale: 'en',
    theme: 'dark',
    width: 390,
    name: 'en dark 390',
  });
  await page.getByRole('button', { name: 'Demo menu' }).click();
  await page.getByRole('menuitemradio', { name: 'Staff' }).click();
  await page.getByRole('button', { name: 'Demo menu' }).click();
  await expect(
    page.getByRole('menuitemradio', { name: 'Staff' }),
  ).toBeChecked();
});

test('embedded in another site, the session survives navigation through ?sid', async ({
  page,
}) => {
  const frame = await openEmbedded(page, {
    appOrigin: 'http://localhost:3010',
    path: '/session',
    locale: 'th',
    theme: 'dark',
  });
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'dark');
  const firstSid = await frame.getByTestId('sid').textContent();
  expect(firstSid).toMatch(/^[0-9a-f-]{36}$/);
  await expect(frame.getByTestId('via')).toHaveText('new');

  await frame.getByRole('link', { name: 'เปิดหน้านี้อีกครั้ง' }).click();
  await expect(frame.getByTestId('via')).toHaveText('query');
  await expect(frame.getByTestId('sid')).toHaveText(firstSid!);
});

test('standalone, the session rides on the cookie', async ({ page }) => {
  await page.goto('/en/session');
  const firstSid = await page.getByTestId('sid').textContent();
  await page.goto('/en/session');
  await expect(page.getByTestId('via')).toHaveText('cookie');
  await expect(page.getByTestId('sid')).toHaveText(firstSid!);
});
