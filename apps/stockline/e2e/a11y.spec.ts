import {
  expectNoA11yViolations,
  openEmbedded,
  openVariant,
  variants,
} from '@peera/test-utils';
import { expect, test } from './fixtures';

// th/en × light/dark × 390/1280 (platform §8) on the main screens, with axe and a screenshot each.
const PAGES = [
  '',
  '/dashboard',
  '/items',
  '/reorder',
  '/history',
  '/counts',
  '/settings',
  '/settings/categories',
];

// Entrance animations fade rows in, and axe reads their mid-fade colours as low contrast. Reduced motion shows
// the final colours at once; the colours themselves are the same with motion on.
test.use({ reducedMotion: 'reduce' });

for (const variant of variants) {
  test(`main screens pass axe, no horizontal scroll (${variant.name})`, async ({
    page,
  }, info) => {
    test.setTimeout(400_000);
    for (const path of PAGES) {
      await openVariant(page, path, variant);
      await expect(page.locator('h1')).toHaveCount(1);
      await expectNoA11yViolations(page);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `${path} overflows by ${overflow}px`,
      ).toBeLessThanOrEqual(0);
      await page.screenshot({
        path: info.outputPath(
          `${(path || '/quick').slice(1)}-${info.project.name}-${variant.locale}-${variant.theme}-${variant.width}.png`,
        ),
      });
    }
  });
}

test('the move sheet and scan overlay pass axe', async ({ page }) => {
  // The sheet is the phone flow (the desktop shows a panel instead).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/th');
  await page
    .getByRole('region', { name: 'ใกล้หมด' })
    .getByRole('button')
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'สแกน', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'สแกนบาร์โค้ด' }),
  ).toBeVisible();
  await expectNoA11yViolations(page, { exclude: ['video'] });
  // The result card that stops after a read.
  await page.getByRole('button', { name: 'สแกนตัวอย่าง' }).click();
  await expect(page.getByText('จะทำอะไรต่อ')).toBeVisible();
  await expectNoA11yViolations(page, { exclude: ['video'] });
});

test('framed by the website without cookies, the session travels in ?sid and writes work', async ({
  page,
}) => {
  const frame = await openEmbedded(page, {
    appOrigin: 'http://localhost:3011',
    path: '/items',
    locale: 'en',
    theme: 'dark',
  });
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'dark');
  // Internal links carry the signed session id (dev/http cookies are SameSite=Lax, so the frame gets none).
  const href = await frame
    .locator('main a[href*="/items/"]')
    .first()
    .getAttribute('href');
  expect(href).toMatch(/[?&]sid=[0-9a-f-]{36}\./);
  await frame
    .getByRole('navigation', { name: 'Main navigation' })
    .first()
    .getByRole('link', { name: 'Quick move' })
    .click();
  await frame
    .getByRole('region', { name: 'Running low' })
    .getByRole('button')
    .nth(2)
    .click();
  await frame.getByRole('button', { name: 'Save In' }).click();
  await expect(
    frame.getByRole('region', { name: /Notifications/ }).getByText(/In saved/),
  ).toBeVisible({ timeout: 20_000 });
  // The same browser store on the next page: quick move lists the item under Recent. (History reads the server
  // clone until S9 moves it to the store.)
  await frame
    .getByRole('navigation', { name: 'Main navigation' })
    .first()
    .getByRole('link', { name: 'Items', exact: true })
    .click();
  await frame
    .getByRole('navigation', { name: 'Main navigation' })
    .first()
    .getByRole('link', { name: 'Quick move' })
    .click();
  await expect(
    frame.locator('section[aria-labelledby="recent-title"]'),
  ).toBeVisible();
  // Framed by the website, the account menu offers to open the demo in its own tab.
  await frame.getByRole('button', { name: /^Account: / }).click();
  await expect(
    frame.getByRole('menuitem', { name: 'Open in new tab' }),
  ).toBeVisible();
});
