'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { REPAIR_STATUSES } from '../domain/repair';
import { addOwnerNote, updateTicket } from '../db/writes/repairs';
import { defineAction } from '../server/actions';

const owner = { roles: ['owner'] } as const;
const money = z.number().int().min(0).max(1_000_000_000_00);

/** The owner's board: move a ticket, assign, schedule, cost and bill, or close it. */
export const updateRepairNow = defineAction(
  z.object({
    ticketId: z.uuid(),
    status: z.enum(REPAIR_STATUSES).optional(),
    assignee: z.string().trim().max(80).nullable().optional(),
    scheduledAt: z.iso.datetime().nullable().optional(),
    costSatang: money.nullable().optional(),
    billToRenter: z.boolean().optional(),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) =>
      updateTicket(tx, tenantId, {
        ...input,
        scheduledAt: input.scheduledAt === undefined ? undefined : input.scheduledAt === null ? null : new Date(input.scheduledAt),
      }),
    );
    revalidatePath('/', 'layout');
    return result;
  },
);

export const addRepairNoteNow = defineAction(
  z.object({ ticketId: z.uuid(), body: z.string().trim().min(1).max(500) }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) => addOwnerNote(tx, tenantId, input));
    revalidatePath('/', 'layout');
    return result;
  },
);
