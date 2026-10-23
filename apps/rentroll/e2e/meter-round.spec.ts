import { expect, test, type Page } from '@playwright/test';

const ROUND = '/th/owner/meters/current';
const inputs = (page: Page) => page.locator('input[id^="meter-"]');

/** Each card's id and the previous reading shown on it (0 when the room has no history). */
async function cards(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('input[id^="meter-"]')].map((el) => {
      const shown = el.closest('section')?.querySelectorAll('.tabular-nums')[1]?.textContent ?? '';
      const saved = (el.closest('section')?.textContent ?? '').includes('บันทึกแล้ว');
      return { id: el.id, previous: Number(shown) || 0, saved };
    }),
  );
}

async function openRound(page: Page) {
  await page.goto(ROUND);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(inputs(page).first()).toBeVisible();
  // Typing before hydration finishes would miss the React handlers; wait for the page to settle first.
  await page.waitForLoadState('networkidle');
}

async function expectProgress(page: Page, read: number, total: number) {
  await expect(page.locator('p').filter({ hasText: `${read}/${total}` }).first()).toBeVisible();
}

/** The "read" number in the sticky progress line, e.g. 24 from "จดแล้ว 24/30 ห้อง". */
async function readCount(page: Page): Promise<number> {
  const text = await page.locator('p').filter({ hasText: /\d+\/\d+/ }).first().innerText();
  const match = /(\d+)\/\d+/.exec(text);
  return match ? Number(match[1]) : -1;
}

async function typeAndLeave(page: Page, id: string, value: number | string) {
  const input = page.locator(`[id="${id}"]`);
  await input.fill(String(value));
  await input.press('Enter');
}

test.describe('meter round', () => {
  test('reads every room of the first building on a 390px phone, one card per room', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openRound(page);
    const rows = await cards(page);
    expect(rows.length).toBeGreaterThanOrEqual(30);

    for (const row of rows) {
      await typeAndLeave(page, row.id, row.previous + 30);
    }
    await expectProgress(page, rows.length, rows.length);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'no horizontal scroll at 390px').toBeLessThanOrEqual(0);
  });

  test('a lower reading waits for the rollover choice, then saves', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRound(page);
    // A room with no saved reading yet, so the card starts without a "saved" badge.
    const first = (await cards(page)).find((c) => !c.saved && c.previous > 10);
    expect(first, 'an unread room with history').toBeDefined();
    const previous = first!.previous;

    // Scope every check to this room's card: other rooms may already show "saved" from the seed.
    const card = page.locator('section').filter({ has: page.locator(`[id="${first!.id}"]`) });
    const banner = card.getByRole('status');
    await expect(card.getByText('บันทึกแล้ว')).toHaveCount(0);

    await typeAndLeave(page, first!.id, previous - 5);
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('มิเตอร์วนรอบหรือพิมพ์ผิด');
    await expect(card.getByText('บันทึกแล้ว')).toHaveCount(0);

    // Confirming the rollover saves the reading, which closes the banner; so assert the outcome, not the checkbox.
    await banner.getByRole('checkbox', { name: 'ยืนยันว่ามิเตอร์วนรอบ' }).click();
    await expect(card.getByText('บันทึกแล้ว')).toBeVisible();
    // With the rollover confirmed the question is gone. The wrapped reading is ~100,000 units, which the usage rule
    // flags as more than double the average, so the banner may remain for that reason only.
    await expect(banner.getByText('มิเตอร์วนรอบหรือพิมพ์ผิด')).toHaveCount(0);
  });

  test('reads all 42 meter rooms of both buildings in one session on a 390px phone (40+ target)', async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openRound(page);
    // The round shows one building at a time. Every link carries the building id (?b=), so the distinct ids are the buildings.
    const buildingIds = await page
      .locator('a[href*="b="]')
      .evaluateAll((links) => [
        ...new Set(links.map((a) => new URL(a.getAttribute('href')!, location.href).searchParams.get('b')!)),
      ]);
    expect(buildingIds.length, 'two buildings').toBe(2);

    let total = 0;
    for (const id of buildingIds) {
      await page.goto(`${ROUND}?b=${id}`);
      await expect(inputs(page).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      const rows = await cards(page);
      total += rows.length;
      for (const row of rows) {
        await typeAndLeave(page, row.id, row.previous + 30);
      }
      await expectProgress(page, rows.length, rows.length);
      // The last save can still be in flight; let it finish before the next building loads.
      await page.waitForLoadState('networkidle');
    }
    expect(total, 'rooms read in one session').toBeGreaterThanOrEqual(40);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'no horizontal scroll at 390px').toBeLessThanOrEqual(0);
  });

  test('offline readings queue on the device, sync once when back online, and never double up', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openRound(page);
    const rows = await cards(page);
    const [a, b] = rows.slice(0, 2);
    const total = rows.length;
    const readBefore = await readCount(page);

    await context.setOffline(true);
    await expect(page.getByText('ออฟไลน์')).toBeVisible();

    // Room A is typed twice while offline: the queue keeps only the latest value.
    await typeAndLeave(page, a!.id, a!.previous + 10);
    await typeAndLeave(page, a!.id, a!.previous + 25);
    await typeAndLeave(page, b!.id, b!.previous + 7);
    await expect(page.getByText('รอซิงก์').first()).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^รอซิงก์ 2$/ }).first()).toBeVisible();

    const queued = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const request = indexedDB.open('rentroll-meter-queue', 1);
          request.onsuccess = () => {
            const db = request.result;
            const all = db.transaction('readings').objectStore('readings').getAll();
            all.onsuccess = () => {
              db.close();
              resolve(all.result.length);
            };
          };
          request.onerror = () => resolve(-1);
        }),
    );
    expect(queued, 'two rooms queued, one entry each').toBe(2);

    await context.setOffline(false);
    await expect(page.getByText('รอซิงก์')).toHaveCount(0, { timeout: 30_000 });

    await openRound(page);
    await expect(inputs(page).nth(0)).toHaveValue(String(a!.previous + 25));
    await expect(inputs(page).nth(1)).toHaveValue(String(b!.previous + 7));
    const readAfter = await readCount(page);
    expect(readAfter, 'progress counts the rooms read offline').toBeGreaterThanOrEqual(readBefore);
    expect(readAfter).toBeLessThanOrEqual(total);
  });
});
