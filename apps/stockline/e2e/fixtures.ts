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
// The account menu at the foot of the sidebar (desktop layout): "Account: <name>, <role>".
const accountButton = { en: /^Account: /, th: /^บัญชี: / };

/** Switches user (the demo role) from the account menu (desktop layout) and waits for the role's landing page. */
export async function setRole(
  page: Page,
  role: 'owner' | 'staff',
  locale: 'en' | 'th' = 'en',
) {
  await page.getByRole('button', { name: accountButton[locale] }).click();
  await page
    .getByRole('menuitemradio', { name: new RegExp(`· ${roleLabel[locale][role]}$`) })
    .click();
  await expect(
    page.getByRole('button', {
      name: new RegExp(`, ${roleLabel[locale][role]}$`),
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
