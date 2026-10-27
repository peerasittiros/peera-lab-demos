import type { Page } from '@playwright/test';
import { expect, expectToast, setRole, test } from './fixtures';

// The move sheet is the phone and tablet flow; from 1024 px the form sits in a panel beside the list (V3).
test.use({ viewport: { width: 390, height: 844 } });

const copy = {
  en: {
    in: 'In',
    out: 'Out',
    adjust: 'Adjust',
    save: 'Save',
    list: 'Running low',
    note: 'Note',
    decrease: 'Decrease',
  },
  th: {
    in: 'รับเข้า',
    out: 'เบิกออก',
    adjust: 'ปรับยอด',
    save: 'บันทึก',
    list: 'ใกล้หมด',
    note: 'หมายเหตุ',
    decrease: 'ลด',
  },
};

/** The first item in the "running low" list that still has stock. */
async function pickStocked(page: Page, locale: 'en' | 'th') {
  const rows = page
    .getByRole('region', { name: copy[locale].list })
    .getByRole('button');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const text = (await rows.nth(index).innerText()).replace(/\s+/g, ' ');
    if (!/(^| )0 /.test(text)) return rows.nth(index);
  }
  throw new Error('no stocked item in the list');
}

const saveButton = (save: string, type: string) =>
  new RegExp(`^${save}\\s?${type}$`);

for (const locale of ['en', 'th'] as const) {
  test(`records In, Out and Adjust in at most three taps after picking an item (${locale})`, async ({
    page,
  }) => {
    const c = copy[locale];
    await page.goto(`/${locale}`);
    const dialog = page.getByRole('dialog');

    // In: one tap (Save).
    await (await pickStocked(page, locale)).click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole('button', { name: saveButton(c.save, c.in) })
      .click();
    await expectToast(page, new RegExp(c.in));
    await expect(dialog).toBeHidden();

    // Out: two taps (Out, Save).
    await (await pickStocked(page, locale)).click();
    await dialog.getByRole('radio', { name: c.out, exact: true }).click();
    await dialog
      .getByRole('button', { name: saveButton(c.save, c.out) })
      .click();
    await expect(dialog).toBeHidden();
    await expectToast(page, new RegExp(c.out));

    // Adjust: Adjust, minus, a typed note, Save.
    await (await pickStocked(page, locale)).click();
    await dialog.getByRole('radio', { name: c.adjust, exact: true }).click();
    await dialog
      .getByRole('button', { name: new RegExp(c.decrease, 'i') })
      .click();
    await dialog
      .getByLabel(new RegExp(c.note))
      .fill(locale === 'th' ? 'ขวดแตก' : 'One broken');
    await dialog
      .getByRole('button', { name: saveButton(c.save, c.adjust) })
      .click();
    await expect(dialog).toBeHidden();
    await expectToast(page, new RegExp(c.adjust));

    // The three moves are in the browser's log, and they survive a reload. (History reads the server clone until
    // S9 moves it to the store.)
    await expect(async () => {
      expect((await storedOps(page)).map((op) => op.payload.type)).toEqual([
        'in',
        'out',
        'adjust',
      ]);
    }).toPass({ timeout: 10_000 });
    await page.reload();
    expect((await storedOps(page)).length).toBe(3);
  });
}

test('pack units convert live, and the entry is kept as entered', async ({
  page,
}) => {
  await page.goto('/en');
  await page.waitForLoadState('networkidle');
  await page.getByRole('searchbox').fill('Drinking water 600');
  await page
    .getByRole('region', { name: 'Items' })
    .getByRole('button')
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: /Case ×24/ }).click();
  await expect(dialog.getByText('= 24 bottles')).toBeVisible();
  await dialog.getByRole('button', { name: 'Increase' }).click();
  await expect(dialog.getByText('= 48 bottles')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save In' }).click();
  await expectToast(page, /\+48 bottles/);
  // Stored as entered (2 cases) and in base units (48 bottles).
  await expect(async () => {
    const [op] = await storedOps(page);
    expect(op?.payload.enteredQty).toBe(2);
    expect(op?.payload.quantityBase).toBe(48);
  }).toPass({ timeout: 10_000 });
});

/** The browser's stored ops, read from IndexedDB, in the order they were recorded. */
async function storedOps(page: Page) {
  return page.evaluate(
    () =>
      new Promise<
        {
          at: string;
          payload: {
            type: string;
            enteredQty: number | null;
            quantityBase: number;
          };
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

test('the owner is warned below zero; staff are blocked', async ({ page }) => {
  // The sheet flow (phones); from 1024 the same form sits in the side panel.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en');
  const outOfStock = () =>
    page
      .getByRole('region', { name: 'Running low' })
      .getByRole('button')
      .filter({ has: page.getByText(/^0 /) })
      .first();
  await outOfStock().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Out', exact: true }).click();
  await expect(dialog.getByText(/takes stock below zero/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save Out' })).toBeEnabled();
  await page.keyboard.press('Escape');

  // The role menu is in the desktop top bar; switch there and come back to the phone sheet.
  await page.setViewportSize({ width: 1280, height: 900 });
  await setRole(page, 'staff');
  await page.setViewportSize({ width: 390, height: 844 });
  await outOfStock().click();
  await dialog.getByRole('radio', { name: 'Out', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Staff cannot take stock below zero',
  );
  await expect(dialog.getByRole('button', { name: 'Save Out' })).toBeDisabled();
});

test('search finds Thai and English names and shows an empty state', async ({
  page,
}) => {
  await page.goto('/th');
  await page.waitForLoadState('networkidle');
  await page.getByRole('searchbox').fill('บะหมี่');
  await expect(
    page.getByRole('region', { name: 'สินค้า' }).getByRole('button').first(),
  ).toContainText('บะหมี่');
  await page.getByRole('searchbox').fill('zzzz-nothing');
  await expect(page.getByText('ไม่พบสินค้าที่ตรงกับ')).toBeVisible();
});
