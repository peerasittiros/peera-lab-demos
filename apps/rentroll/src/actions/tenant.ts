'use server';

import { ActionError } from '@peera/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { tenantContract } from '../db/queries/tenant';
import { createRepairTicket, postAnnouncement } from '../db/writes/tenant';
import { PREFERRED_TIMES, REPAIR_CATEGORIES } from '../domain/repair';
import { bangkokDate } from '../domain/dates';
import { defineAction } from '../server/actions';

const payer = { roles: ['owner', 'tenant'] } as const;
const owner = { roles: ['owner'] } as const;

/** A repair request from the tenant's own room. The room comes from the tenant's live contract, not the input. */
export const createRepairNow = defineAction(
  z.object({
    category: z.enum(REPAIR_CATEGORIES),
    description: z.string().trim().min(1).max(500),
    preferredTime: z.enum(PREFERRED_TIMES),
    allowEntry: z.boolean(),
  }),
  payer,
  async (input, { db, tenantId }) => {
    const current = await tenantContract(db, tenantId, bangkokDate(new Date()));
    if (!current) throw new ActionError('contract.not_found', 'tenant.errors.noContract');
    const result = await db.transaction((tx) =>
      createRepairTicket(tx, tenantId, { ...input, roomId: current.roomId, renterId: current.renterId }),
    );
    revalidatePath('/', 'layout');
    return result;
  },
);

export const postAnnouncementNow = defineAction(
  z.object({
    buildingId: z.uuid(),
    titleTh: z.string().trim().min(1).max(120),
    titleEn: z.string().trim().min(1).max(120),
    bodyTh: z.string().trim().min(1).max(1000),
    bodyEn: z.string().trim().min(1).max(1000),
  }),
  owner,
  async (input, { db, tenantId }) => {
    const result = await db.transaction((tx) => postAnnouncement(tx, tenantId, { ...input, publishedAt: new Date() }));
    revalidatePath('/', 'layout');
    return result;
  },
);
