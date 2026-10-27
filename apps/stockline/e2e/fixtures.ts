import { expect, test as base, type Page } from '@playwright/test';

/** Every test: a fresh visitor (own tenant) with the first-visit tour already dismissed. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('peera:coach:stockline', 'done');
      } catch {
        // Storage blocked in this context; the tour may show.
      }
    });
    await provide(page);
  },
});

export { expect };

const roleLabel = {
  en: { owner: 'Owner', staff: 'Staff' },
  th: { owner: 'เจ้าของร้าน', staff: 'พนักงาน' },
};
const roleButton = { en: /Role: /, th: /บทบาท: / };

/** Switches the demo role from the DemoBar (desktop layout) and waits for the role's landing page. */
export async function setRole(
  page: Page,
  role: 'owner' | 'staff',
  locale: 'en' | 'th' = 'en',
) {
  await page.getByRole('button', { name: roleButton[locale] }).click();
  await page
    .getByRole('menuitemradio', { name: roleLabel[locale][role] })
    .click();
  await expect(
    page.getByRole('button', {
      name: new RegExp(`${roleLabel[locale][role]}`),
    }),
  ).toBeVisible();
  await page.waitForURL(
    role === 'owner' ? /\/dashboard/ : new RegExp(`/${locale}(\\?|$)`),
  );
}

/** Waits for a toast whose text matches (toasts follow the server's answer, so allow for a slow one). */
export async function expectToast(page: Page, text: RegExp | string) {
  await expect(
    page
      .getByRole('region', { name: /Notifications|การแจ้งเตือน/ })
      .getByText(text)
      .first(),
  ).toBeVisible({ timeout: 20_000 });
}
