'use server';

import { ActionError } from '@peera/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { saveMeterReading } from '../db/writes/meters';
import { defineAction } from '../server/actions';

const period = z.string().regex(/^\d{4}-\d{2}$/);
const reading = z.number().int().min(0).max(99_999_999);
const roles = { roles: ['owner', 'caretaker'] } as const;

const readingInput = z.object({
  roomId: z.uuid(),
  kind: z.enum(['electricity', 'water']),
  period,
  reading,
  rollover: z.boolean(),
  readAt: z.iso.datetime(),
});

export const saveMeterReadingNow = defineAction(readingInput, roles, async (input, { db, tenantId, role }) => {
  const result = await db.transaction((tx) =>
    saveMeterReading(tx, tenantId, { ...input, readBy: role, readAt: new Date(input.readAt) }),
  );
  revalidatePath('/', 'layout');
  return result;
});

/**
 * Sends the offline queue. Each item is its own transaction, so one refused reading does not hold back the others,
 * and resending an item that already reached the server changes nothing (`saveMeterReading` is idempotent).
 */
export const syncMeterQueueNow = defineAction(
  z.object({
    items: z.array(readingInput.extend({ key: z.string().max(200) })).max(200),
  }),
  roles,
  async ({ items }, { db, tenantId, role }) => {
    const results: { key: string; ok: boolean; messageKey?: string; code?: string }[] = [];
    for (const item of items) {
      try {
        await db.transaction((tx) =>
          saveMeterReading(tx, tenantId, { ...item, readBy: role, readAt: new Date(item.readAt) }),
        );
        results.push({ key: item.key, ok: true });
      } catch (error) {
        if (!(error instanceof ActionError)) throw error;
        results.push({ key: item.key, ok: false, code: error.code, messageKey: error.messageKey });
      }
    }
    revalidatePath('/', 'layout');
    return { results };
  },
);
