import { z } from 'zod';
import { MAX_IMAGE_CHARS } from './limits';

// Input schemas for items, suppliers, categories, units and the shop settings. The server actions and the browser
// commands (`client-store/master-commands.ts`) both check input with these, so they accept and reject the same things.

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

const money = z
  .number()
  .finite()
  .min(0)
  .max(10_000_000)
  .nullable()
  .default(null);
const count = z.number().int().min(0).max(10_000_000);

/**
 * An uploaded picture as the browser stores it: a WebP (or, from older Safari, JPEG) data URL from
 * `imageToDataUrl`, at most about 120 KB.
 */
export const imageDataUrl = z
  .string()
  .max(MAX_IMAGE_CHARS)
  .regex(/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+=*$/);
/** An item photo: an upload, or one of the sample photos under `/products/`. */
const itemImage = z.union([
  imageDataUrl,
  z.string().regex(/^\/products\/[a-z0-9-]+\.webp$/),
]);

export const itemFields = z
  .object({
    nameTh: z.string().trim().min(1).max(120),
    nameEn: optionalText(120),
    sku: optionalText(40),
    barcode: optionalText(64),
    categoryId: z.uuid().nullable().default(null),
    baseUnitId: z.uuid(),
    packs: z
      .array(
        z.object({
          unitId: z.uuid(),
          factor: z.number().int().min(2).max(100_000),
        }),
      )
      .max(5)
      .default([]),
    costBaht: money,
    priceBaht: money,
    minQty: count.default(0),
    reorderQty: count.default(0),
    supplierId: z.uuid().nullable().default(null),
    location: optionalText(80),
    // Undefined keeps the current photo; null removes it.
    imageUrl: itemImage.nullable().optional(),
  })
  .superRefine((input, context) => {
    const units = input.packs.map((pack) => pack.unitId);
    if (
      units.includes(input.baseUnitId) ||
      new Set(units).size !== units.length
    )
      context.addIssue({
        code: 'custom',
        path: ['packs'],
        message: 'duplicate unit',
      });
  });

export type ItemFields = z.output<typeof itemFields>;

export const createItemInput = itemFields.and(
  z.object({ openingQty: count.default(0) }),
);

export const supplierFields = z.object({
  name: z.string().trim().min(1).max(120),
  contactName: text(120),
  phone: text(30),
  lineId: text(60),
  leadTimeDays: z.number().int().min(0).max(120),
  note: text(500),
});

/**
 * Shop settings, saved a page at a time (Shop, Stock rules): a field left out keeps its current value, and null clears
 * an optional one.
 */
export const settingsFields = z.object({
  shopNameTh: z.string().trim().min(1).max(120).optional(),
  shopNameEn: z.string().trim().max(120).nullable().optional(),
  lowStockRule: z.enum(['at_or_below_min', 'below_min']).optional(),
  reorderWeekday: z.number().int().min(1).max(7).optional(),
  logoUrl: imageDataUrl.nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
});

/** A sample person's display name (owner or staff), as the account menu and history show it. */
export const userFields = z.object({
  role: z.enum(['owner', 'staff']),
  displayName: z.string().trim().min(1).max(60),
});

export const namedFields = z.object({
  nameTh: z.string().trim().min(1).max(60),
  nameEn: text(60),
});

export const unitFields = namedFields.and(
  z.object({ symbol: z.string().trim().min(1).max(12) }),
);
