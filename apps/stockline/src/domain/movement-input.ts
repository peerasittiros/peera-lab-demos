import { z } from 'zod';
import { MAX_DECIMALS } from './stock';

// The movement form's input, shared by the server action (`actions/movements.ts`) and the browser command
// (`client-store/commands.ts`), so both accept and reject the same things.

const quantity = z
  .number()
  .finite()
  .refine(
    (value) => Number.isInteger(value * 10 ** MAX_DECIMALS),
    'too many decimals',
  )
  .refine((value) => Math.abs(value) <= 1_000_000, 'too large');

export const movementSchema = z
  .object({
    itemId: z.uuid(),
    type: z.enum(['in', 'out', 'adjust']),
    reason: z.string().min(1).max(40),
    /** As entered: positive for in/out, signed for adjust. */
    quantity,
    /** The entered unit; null = the item's base unit. */
    unitId: z.uuid().nullable().default(null),
    note: z.string().trim().max(500).optional(),
    reference: z.string().trim().max(80).optional(),
    /** Baht per base unit, owner only. */
    unitCostBaht: z
      .number()
      .finite()
      .min(0)
      .max(1_000_000)
      .nullable()
      .optional(),
  })
  .superRefine((input, context) => {
    if (input.quantity === 0)
      context.addIssue({ code: 'custom', path: ['quantity'], message: 'zero' });
    if (input.type !== 'adjust' && input.quantity < 0)
      context.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'negative',
      });
  });

export type RecordMovementInput = z.input<typeof movementSchema>;
