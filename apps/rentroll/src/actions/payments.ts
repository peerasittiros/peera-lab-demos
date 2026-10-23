'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { bangkokDate } from '../domain/dates';
import {
  approvePayment,
  recordManualPayment,
  rejectPayment,
  sendReminder,
  submitSlip,
} from '../db/writes/payments';
import { defineAction } from '../server/actions';

const owner = { roles: ['owner'] } as const;
const payer = { roles: ['owner', 'tenant'] } as const;

/** The tenant's slip. The slip image itself is not stored in the demo (01 §6.1); the record and amount are. */
export const submitSlipNow = defineAction(
  z.object({
    invoiceId: z.uuid(),
    amountSatang: z.number().int().min(1).max(1_000_000_000_00),
    slipUrl: z.string().max(300).nullable(),
  }),
  payer,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) =>
      submitSlip(tx, tenantId, { ...input, paidAt: new Date() }),
    );
    revalidatePath('/', 'layout');
    return result;
  },
);

export const approvePaymentNow = defineAction(
  z.object({
    paymentId: z.uuid(),
    amountSatang: z.number().int().min(1).optional(),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) => approvePayment(tx, tenantId, { ...input, reviewer: 'owner' }));
    revalidatePath('/', 'layout');
    return result;
  },
);

export const rejectPaymentNow = defineAction(
  z.object({ paymentId: z.uuid(), reason: z.string().trim().min(1).max(200) }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) => rejectPayment(tx, tenantId, { ...input, reviewer: 'owner' }));
    revalidatePath('/', 'layout');
    return result;
  },
);

export const recordManualPaymentNow = defineAction(
  z.object({
    contractId: z.uuid(),
    amountSatang: z.number().int().min(1).max(1_000_000_000_00),
    method: z.enum(['cash', 'transfer']),
    paidAt: z.iso.datetime(),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) =>
      recordManualPayment(tx, tenantId, { ...input, paidAt: new Date(input.paidAt), reviewer: 'owner' }),
    );
    revalidatePath('/', 'layout');
    return result;
  },
);

export const sendReminderNow = defineAction(z.object({ invoiceId: z.uuid() }), owner, async ({ invoiceId }, { db, tenantId }) => {
  const result = await db.transaction((tx) => sendReminder(tx, tenantId, { invoiceId, today: bangkokDate(new Date()) }));
  revalidatePath('/', 'layout');
  return result;
});
