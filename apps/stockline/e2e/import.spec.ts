import { expect, test } from './fixtures';

const csv = [
  'ชื่อสินค้า,รหัสสินค้า,หน่วย,จำนวน,ราคาทุน,ขั้นต่ำ,วันที่',
  'ชาไทยพร้อมดื่ม 350 มล.,TEA-350,ขวด,"1,200",12.50,240,1/10/2569',
  'ขนมเปี๊ยะ,PIA-01,ชิ้น,36,18,12,21 ต.ค. 2569',
  ',EMPTY,ชิ้น,3,,,',
].join('\r\n');

test('imports a small Thai CSV: map, review with a bad row, done', async ({
  page,
}) => {
  await page.goto('/th/import');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'stock.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`\uFEFF${csv}`, 'utf8'),
  });
  // Columns were recognised from the Thai headers.
  await expect(
    page.getByRole('combobox', { name: 'ชื่อสินค้า' }),
  ).toContainText('ชื่อสินค้า (ไทย)');
  await expect(page.getByRole('combobox', { name: 'ราคาทุน' })).toContainText(
    'ราคาทุน',
  );
  await page.getByRole('button', { name: 'ถัดไป' }).click();

  await expect(page.getByText('พร้อมนำเข้า 2 แถว')).toBeVisible();
  await expect(page.getByText('มีปัญหา 1 แถว')).toBeVisible();
  await expect(page.getByText(/แถว 4: ไม่มีชื่อสินค้า/)).toBeVisible();
  await page.getByRole('button', { name: 'นำเข้า 2 รายการ' }).click();
  await expect(
    page.getByRole('heading', { name: 'นำเข้าแล้ว 2 รายการ' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'ดูรายการสินค้า' }).click();
  await page.getByLabel('ค้นหาสินค้า').fill('TEA-350');
  await expect(page.getByText('ชาไทยพร้อมดื่ม 350 มล.').first()).toBeVisible();
});

test('an Excel file asks for CSV while SheetJS is not installed', async ({
  page,
}) => {
  await page.goto('/en/import');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'stock.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('PK'),
  });
  await expect(page.getByText(/Save the sheet as CSV/)).toBeVisible();
});
