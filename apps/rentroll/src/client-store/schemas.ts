import { z } from 'zod';

// Every Zod schema the browser's commands check input with. Commands load this module on first use (`loadSchemas` in
// `commands/payments.ts`), so Zod is not parsed and evaluated on page load, only before the first save (V8).

/** An ISO date, `YYYY-MM-DD`. */
export const dateInput = z.iso.date();

// Payments.

export const slipInput = z.object({
  invoiceId: z.uuid(),
  amountSatang: z.number().int().min(1),
  slipUrl: z.enum(['sample', 'uploaded']).nullable(),
});
const decisionInput = z.object({ paymentId: z.uuid() });
export const approveInput = decisionInput.extend({
  amountSatang: z.number().int().min(1).optional(),
});
export const rejectInput = decisionInput.extend({
  reason: z.string().trim().min(1).max(200),
});
export const manualInput = z.object({
  contractId: z.uuid(),
  amountSatang: z.number().int().min(1),
  method: z.enum(['cash', 'transfer']),
});

// Billing.

export const lineInput = z.object({
  id: z.uuid().optional(),
  kind: z.enum([
    'rent',
    'electricity',
    'water',
    'extra',
    'one_off',
    'late_fee',
    'previous_balance',
  ]),
  labelTh: z.string().trim().min(1).max(120),
  labelEn: z.string().trim().min(1).max(120),
  amountSatang: z.number().int().min(0),
  meta: z.record(z.string(), z.unknown()).default({}),
});
export const lineListInput = z.array(lineInput);
export const creditNoteInput = z.object({
  invoiceId: z.uuid(),
  amountSatang: z.number().int().positive(),
  reason: z.string().trim().min(1).max(200),
});

// Contracts.

export const checklistInput = z.array(
  z.object({
    key: z.enum([
      'walls',
      'floor',
      'door_lock',
      'aircon',
      'furniture',
      'appliances',
    ]),
    status: z.enum(['ok', 'damaged']).nullable(),
  }),
);
export const moveInInput = z.object({
  roomId: z.uuid(),
  renter: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('new'),
      name: z.string().trim().min(1).max(120),
      phone: z.string().trim().max(40).nullable(),
    }),
    z.object({ mode: z.literal('existing'), renterId: z.uuid() }),
  ]),
  startDate: z.iso.date(),
  monthlyRentSatang: z.number().int().min(0),
  depositSatang: z.number().int().min(0),
  advanceMonths: z.number().int().min(0).max(12),
  occupants: z.number().int().min(1).max(20),
  parkingSatang: z.number().int().min(0),
  internetSatang: z.number().int().min(0),
  elecReading: z.number().int().min(0),
  waterReading: z.number().int().min(0),
  checklist: checklistInput,
});
export const moveOutInput = z.object({
  contractId: z.uuid(),
  moveOutDate: z.iso.date(),
  elecReading: z.number().int().min(0),
  waterReading: z.number().int().min(0),
  elecRollover: z.boolean(),
  waterRollover: z.boolean(),
  damages: z.number().int().min(0),
  cleaningFee: z.number().int().min(0),
  checklist: checklistInput,
});

// Meters.

export const readingInput = z.object({
  roomId: z.uuid(),
  meterKind: z.enum(['electricity', 'water']),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  reading: z.number().int().min(0),
  rollover: z.boolean(),
});

// The property screens.

export const announcementInput = z.object({
  buildingId: z.uuid(),
  titleTh: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().min(1).max(120),
  bodyTh: z.string().trim().min(1).max(2000),
  bodyEn: z.string().trim().min(1).max(2000),
});
export const repairInput = z.object({
  roomId: z.uuid(),
  category: z.enum([
    'electrical',
    'plumbing',
    'aircon',
    'furniture',
    'internet',
    'other',
  ]),
  description: z.string().trim().min(1).max(2000),
  preferredTime: z.enum(['morning', 'afternoon', 'evening', 'anytime']),
  allowEntry: z.boolean(),
});
export const buildingInput = z.object({
  buildingId: z.uuid(),
  nameTh: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().max(120).nullable(),
  promptpayId: z.string().trim().min(1).max(40),
  billingDay: z.number().int().min(1).max(28),
  dueDay: z.number().int().min(1).max(28),
  /** Omitted keeps the address on file; `null` clears it. */
  addressTh: z.string().trim().max(200).nullable().optional(),
  addressEn: z.string().trim().max(200).nullable().optional(),
});
export const ratePlanInput = z.object({
  buildingId: z.uuid(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  elecRateSatang: z.number().int().min(0),
  elecMinSatang: z.number().int().min(0),
  waterMode: z.enum(['per_unit', 'per_person']),
  waterRateSatang: z.number().int().min(0),
  waterMinSatang: z.number().int().min(0),
  waterPerPersonSatang: z.number().int().min(0),
  commonFeeSatang: z.number().int().min(0),
});
export const roomInput = z.object({
  roomId: z.uuid(),
  number: z.string().trim().min(1).max(12),
  floor: z.number().int().min(-5).max(200),
  roomTypeId: z.uuid(),
  sizeSqm: z.number().positive().max(10000).nullable(),
  elecMeterDigits: z.number().int().min(3).max(8),
  waterMeterDigits: z.number().int().min(3).max(8),
});

// Settings.

export const roomTypeInput = z.object({
  roomTypeId: z.uuid(),
  nameTh: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().max(60).nullable(),
});

/** A command's input, as the form sends it (before the schema trims and fills defaults). */
export type Inputs = {
  moveIn: z.input<typeof moveInInput>;
  moveOut: z.input<typeof moveOutInput>;
  checklist: z.infer<typeof checklistInput>;
  reading: z.input<typeof readingInput>;
  announcement: z.input<typeof announcementInput>;
  repair: z.input<typeof repairInput>;
  building: z.input<typeof buildingInput>;
  ratePlan: z.input<typeof ratePlanInput>;
  room: z.input<typeof roomInput>;
  roomType: z.input<typeof roomTypeInput>;
  line: z.input<typeof lineInput>;
  creditNote: z.input<typeof creditNoteInput>;
};
