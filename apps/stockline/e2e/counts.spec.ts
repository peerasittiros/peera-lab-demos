import type { Page } from '@playwright/test';
import { expect, expectToast, setRole, test } from './fixtures';

test('staff count and submit, the owner approves, history shows the adjustments', async ({
  page,
}) => {
  // The whole count, line by line, then approval: past 60 s in WebKit on a busy machine.
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  await setRole(page, 'staff');
  await page.goto('/en/counts');
  await page.getByRole('button', { name: 'Start a count' }).click();
  const dialog = page.getByRole('dialog', { name: 'Start a stock count' });
  await dialog.getByRole('radio', { name: 'One category' }).check();
  await dialog.getByRole('button', { name: 'Begin counting' }).click();
  await page.waitForURL(/\/en\/counts\/[0-9a-f-]{36}/);

  // Blind count: expected quantities are hidden until a line is counted.
  await expect(page.getByText('Hidden').first()).toBeVisible();
  const saves = page.getByRole('button', { name: /^Save count for / });
  const total = await saves.count();
  expect(total).toBeGreaterThan(2);
  // In a blind count every stepper starts at 0; saving them as they are makes each stocked line a difference.
  const steppers = page.getByRole('spinbutton', {
    name: /Counted quantity for/,
  });
  for (let index = 0; index < total; index += 1) {
    await saves.nth(index).scrollIntoViewIfNeeded();
    await saves.nth(index).click();
    await expect(
      page.getByText(new RegExp(`${index + 1} of ${total} counted`)).first(),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expectToast(page, 'Count submitted');
  await expect(
    page.getByText('Waiting for the owner to approve.'),
  ).toBeVisible();
  await expect(steppers).toHaveCount(0);

  await setRole(page, 'owner');
  await page.goBack();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Review the differences' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Approve and adjust stock' }).click();
  await expectToast(page, /Count approved/);

  // The adjustments are in the browser's log, reason count, linked to the session.
  await expect(async () => {
    const ops = await storedOps(page);
    const adjusts = ops.filter((op) => op.payload.reason === 'count');
    expect(adjusts.length).toBeGreaterThan(0);
    expect(
      adjusts.every(
        (op) =>
          op.payload.type === 'adjust' && op.payload.reference === 'CNT-0002',
      ),
    ).toBe(true);
  }).toPass({ timeout: 10_000 });
  // History shows the adjustments, linked to the count (S9: history reads the browser store).
  await page.goto('/en/history?type=adjust');
  await expect(
    page.locator('main').getByText('CNT-0002').first(),
  ).toBeVisible();
});

/** The browser's stored ops, read from IndexedDB, in the order they were recorded. */
async function storedOps(page: Page) {
  return page.evaluate(
    () =>
      new Promise<
        {
          at: string;
          payload: { type: string; reason: string; reference: string | null };
        }[]
      >((resolve, reject) => {
        const open = indexedDB.open('stockline', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const read = db
            .transaction('ops', 'readonly')
            .objectStore('ops')
            .getAll();
          read.onsuccess = () => {
            db.close();
            resolve(read.result.sort((a, b) => (a.at < b.at ? -1 : 1)));
          };
          read.onerror = () => reject(read.error);
        };
      }),
  );
}
