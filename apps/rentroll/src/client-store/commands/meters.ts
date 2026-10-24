import { z } from 'zod';
import { bangkokDate } from '@/src/domain/dates';
import { readingFor } from '@/src/domain/meter-reading';
import { newId } from '../ids';
import type { CommandContext, CommandResult } from './payments';
import { readingHistory } from '../selectors/meters';

/**
 * Meter reading command (SPEC §4 O9). The caretaker and the owner can read meters. The reading is checked against the
 * room's history (rollover, future month, digits), its units and anomaly are worked out, and one op is dispatched.
 * Offline, the op waits in the store and is stored locally; there is no separate sync step.
 */

const READ_ROLES = ['owner', 'caretaker'] as const;

const readingInput = z.object({
  roomId: z.uuid(),
  meterKind: z.enum(['electricity', 'water']),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  reading: z.number().int().min(0),
  rollover: z.boolean(),
});

export function actSaveReading(
  ctx: CommandContext,
  input: z.input<typeof readingInput>,
): CommandResult<{ unitsUsed: number | null; anomaly: string | null }> {
  if (!READ_ROLES.includes(ctx.role as (typeof READ_ROLES)[number]))
    return { ok: false, error: 'errors.forbidden' };
  const parsed = readingInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'meters.errors.invalid' };

  const data = ctx.store.getState().data;
  const room = data.room.find((r) => r.id === parsed.data.roomId);
  if (!room) return { ok: false, error: 'meters.errors.notFound' };
  const digits =
    parsed.data.meterKind === 'electricity'
      ? room.elecMeterDigits
      : room.waterMeterDigits;
  const today = bangkokDate(ctx.now());
  const result = readingFor(
    readingHistory(data, room.id, parsed.data.meterKind),
    {
      period: parsed.data.period,
      reading: parsed.data.reading,
      rollover: parsed.data.rollover,
    },
    digits,
    today,
  );
  if (!result.ok) return { ok: false, error: result.error };

  const at = ctx.now().toISOString();
  const dispatched = ctx.store.dispatch({
    id: newId(),
    at,
    role: ctx.role,
    kind: 'meter.read',
    payload: {
      readingId: newId(),
      roomId: room.id,
      meterKind: parsed.data.meterKind,
      period: parsed.data.period,
      reading: parsed.data.reading,
      isRollover: parsed.data.rollover,
      unitsUsed: result.unitsUsed,
      anomaly: result.anomaly,
      readBy: ctx.role,
      readAt: at,
    },
  });
  return dispatched
    ? {
        ok: true,
        value: { unitsUsed: result.unitsUsed, anomaly: result.anomaly },
      }
    : { ok: false, error: 'meters.errors.saveFailed' };
}
