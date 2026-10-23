'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { bangkokDate } from '../domain/dates';
import { generateBilling, sendBilling, voidDraft } from '../db/writes/billing';
import { defineAction } from '../server/actions';

const period = z.string().regex(/^\d{4}-\d{2}$/);
const owner = { roles: ['owner'] } as const;

export const generateBillingRun = defineAction(
  z.object({
    buildingId: z.uuid(),
    period,
    estimateRoomIds: z.array(z.uuid()).max(300),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const now = new Date();
    const result = await db.transaction((tx) =>
      generateBilling(tx, tenantId, { ...input, asOf: now, today: bangkokDate(now) }),
    );
    revalidatePath('/', 'layout');
    return result;
  },
);

export const sendBillingRun = defineAction(
  z.object({ buildingId: z.uuid(), period }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) => sendBilling(tx, tenantId, { ...input, sentAt: new Date() }));
    revalidatePath('/', 'layout');
    return result;
  },
);

export const voidInvoice = defineAction(z.object({ invoiceId: z.uuid() }), owner, async ({ invoiceId }, { db, tenantId }) => {
  const result = await db.transaction((tx) => voidDraft(tx, tenantId, invoiceId));
  revalidatePath('/', 'layout');
  return result;
});
