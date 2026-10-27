import { describe, expect, it } from 'vitest';
import { buildReorderList } from './reorder';
import { reorderMessage, type ReorderTextLine } from './reorder-text';
import { suggestReorderQty } from './stock';

const bottle = { nameTh: 'ขวด', nameEn: 'Bottle', symbol: 'btl' };
const pack = { nameTh: 'แพ็ค', nameEn: 'Pack', symbol: 'pk' };
const kase = { nameTh: 'ลัง', nameEn: 'Case', symbol: 'cs' };
const gram = { nameTh: 'กรัม', nameEn: 'Gram', symbol: 'g' };
const bag = { nameTh: 'ถุง', nameEn: 'Bag', symbol: 'bag' };

const linesTh: ReorderTextLine[] = [
  {
    name: 'น้ำดื่ม 600 มล.',
    quantity: 48,
    baseUnit: bottle,
    pack: { unit: kase, factor: 24 },
  },
  {
    name: 'โซดา 325 มล.',
    quantity: 30,
    baseUnit: bottle,
    pack: { unit: pack, factor: 6 },
  },
  {
    name: 'เมล็ดกาแฟคั่วกลาง',
    quantity: 1500,
    baseUnit: gram,
    pack: { unit: bag, factor: 1000 },
  },
];
const linesEn = linesTh.map((line, index) => ({
  ...line,
  name: [
    'Drinking water 600 ml',
    'Soda water 325 ml',
    'Medium roast coffee beans',
  ][index]!,
}));

describe('reorderMessage', () => {
  it('matches the Thai template', () => {
    expect(
      reorderMessage({
        locale: 'th',
        shopName: 'มินิมาร์ทหน้าหมู่บ้าน',
        supplierName: 'บริษัท น้ำใสดี จำกัด',
        lines: linesTh,
      }),
    ).toMatchInlineSnapshot(`
      "เรียน บริษัท น้ำใสดี จำกัด
      มินิมาร์ทหน้าหมู่บ้าน ขอสั่งสินค้าตามรายการนี้

      1. น้ำดื่ม 600 มล. — 2 ลัง (48 ขวด)
      2. โซดา 325 มล. — 5 แพ็ค (30 ขวด)
      3. เมล็ดกาแฟคั่วกลาง — 1,500 กรัม

      รวม 3 รายการ
      รบกวนแจ้งวันส่งของด้วย ขอบคุณ"
    `);
  });

  it('matches the English template', () => {
    expect(
      reorderMessage({
        locale: 'en',
        shopName: 'Village Mini-mart',
        supplierName: 'บริษัท น้ำใสดี จำกัด',
        lines: linesEn,
      }),
    ).toMatchInlineSnapshot(`
      "Hello บริษัท น้ำใสดี จำกัด,
      Village Mini-mart would like to order the following:

      1. Drinking water 600 ml — 2 cases (48 bottles)
      2. Soda water 325 ml — 5 packs (30 bottles)
      3. Medium roast coffee beans — 1,500 g

      3 items in total.
      Please let us know the delivery date. Thank you."
    `);
  });

  it('uses the singular for one item and one pack', () => {
    const text = reorderMessage({
      locale: 'en',
      shopName: 'Shop',
      supplierName: 'Supplier',
      lines: [
        {
          name: 'Water',
          quantity: 24,
          baseUnit: bottle,
          pack: { unit: kase, factor: 24 },
        },
      ],
    });
    expect(text).toContain('1. Water — 1 case (24 bottles)');
    expect(text).toContain('1 item in total.');
  });
});

describe('buildReorderList', () => {
  const base = { reorderQty: 12, packFactor: 6, onOrder: 0 };
  const items = [
    { ...base, itemId: 'a', supplierId: 's1', onHand: 2, minQty: 10 },
    { ...base, itemId: 'b', supplierId: 's2', onHand: 10, minQty: 10 },
    { ...base, itemId: 'c', supplierId: 's1', onHand: 11, minQty: 10 },
    { ...base, itemId: 'd', supplierId: null, onHand: 0, minQty: 4 },
  ];

  it('lists items at or under min, grouped by supplier, without-supplier last', () => {
    const groups = buildReorderList(items);
    expect(groups.map((group) => group.supplierId)).toEqual(['s1', 's2', null]);
    expect(groups[0]!.lines.map((line) => line.itemId)).toEqual(['a']);
  });

  it('suggests the domain quantity for every line', () => {
    for (const group of buildReorderList(items))
      for (const line of group.lines)
        expect(line.suggested).toBe(suggestReorderQty(line));
    // a: max(12, 20 − 2) = 18 → 18 (three packs of 6)
    expect(buildReorderList(items)[0]!.lines[0]!.suggested).toBe(18);
  });

  it('follows the below_min rule', () => {
    const groups = buildReorderList(items, 'below_min');
    expect(
      groups.flatMap((group) => group.lines.map((line) => line.itemId)),
    ).toEqual(['a', 'd']);
  });
});
