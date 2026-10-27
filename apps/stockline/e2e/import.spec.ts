import * as XLSX from 'xlsx';
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

test('imports an Excel workbook: a date cell, numbers and Thai headers', async ({
  page,
}) => {
  // Built here with SheetJS: row 2 has a real date cell (1 Oct 2026) and a formatted quantity, row 3 is missing a name.
  const sheet = XLSX.utils.aoa_to_sheet([
    ['ชื่อสินค้า', 'รหัสสินค้า', 'หน่วย', 'จำนวน', 'ราคาทุน', 'วันที่'],
    ['กาแฟดริปถุง', 'DRIP-10', 'ซอง', 1500, 9.5, null],
    ['', 'EMPTY-2', 'ซอง', 4, null, null],
  ]);
  sheet.F2 = { t: 'n', v: 46296, z: 'd/m/yyyy' };
  sheet.D2 = { t: 'n', v: 1500, z: '#,##0' };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'สต็อก');
  const buffer = Buffer.from(
    XLSX.write(book, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
  );

  await page.goto('/th/import');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'stock.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(
    page.getByRole('combobox', { name: 'ชื่อสินค้า' }),
  ).toContainText('ชื่อสินค้า (ไทย)');
  await page.getByRole('button', { name: 'ถัดไป' }).click();

  await expect(page.getByText('พร้อมนำเข้า 1 แถว')).toBeVisible();
  await expect(page.getByText(/แถว 3: ไม่มีชื่อสินค้า/)).toBeVisible();
  await page.getByRole('button', { name: 'นำเข้า 1 รายการ' }).click();
  await expect(
    page.getByRole('heading', { name: 'นำเข้าแล้ว 1 รายการ' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'ดูรายการสินค้า' }).click();
  await page.getByLabel('ค้นหาสินค้า').fill('DRIP-10');
  await expect(page.getByText('กาแฟดริปถุง').first()).toBeVisible();
});
