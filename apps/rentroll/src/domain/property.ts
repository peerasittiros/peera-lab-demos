import { dayNumber } from './dates';

export type RoomStatus = 'vacant' | 'occupied' | 'reserved' | 'maintenance';

export type ContractForStatus = {
  /** `active`, `notice_given` or `ended` (a text column, so typed loosely here). */
  status: string;
  startDate: string;
  endDate: string | null;
};

/** A contract that is not ended and has not run past its end date by `today`. */
export function isLiveContract(
  contract: ContractForStatus,
  today: string,
): boolean {
  return (
    contract.status !== 'ended' &&
    (contract.endDate === null ||
      dayNumber(contract.endDate) >= dayNumber(today))
  );
}

/**
 * Room status comes from contracts, except the `maintenance` flag, which is set by hand (01 §4).
 * A live contract that has started (active or on notice) makes the room occupied; one that starts later makes it
 * reserved. Anything else is vacant.
 */
export function roomStatus({
  maintenance,
  contracts,
  today,
}: {
  maintenance: boolean;
  contracts: ContractForStatus[];
  today: string;
}): RoomStatus {
  if (maintenance) return 'maintenance';
  const todayNo = dayNumber(today);
  const live = contracts.filter((c) => isLiveContract(c, today));
  if (live.some((c) => dayNumber(c.startDate) <= todayNo)) return 'occupied';
  if (live.some((c) => dayNumber(c.startDate) > todayNo)) return 'reserved';
  return 'vacant';
}

export type RatePlanRow = { id: string; validFrom: string };

/**
 * The plan in force on a date: the latest `valid_from` on or before it. Plans are never edited, so invoices that
 * used an older plan keep their amounts. Returns null before the first plan.
 */
export function ratePlanOn<T extends RatePlanRow>(
  plans: T[],
  date: string,
): T | null {
  const day = dayNumber(date);
  let best: T | null = null;
  for (const plan of plans) {
    if (dayNumber(plan.validFrom) > day) continue;
    if (best === null || dayNumber(plan.validFrom) > dayNumber(best.validFrom))
      best = plan;
  }
  return best;
}
