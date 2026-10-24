import { balanceOf } from '../settlement';
import { daysLate, lateFee } from '@/src/domain/late-fee';
import { ratesOf } from '@/src/domain/billing-run';
import { ratePlanOn } from '@/src/domain/property';
import type { Op } from '../ops';
import type { Data } from '../schema';

/** Selectors for overdue invoices and the reminders sent about them (SPEC §4 O13, O14). */

const OPEN_STATUSES = ['sent', 'partially_paid'];

/** Reminder ops about one invoice, oldest first. */
export function remindersFor(ops: Op[], invoiceId: string) {
  return ops
    .filter(
      (op): op is Extract<Op, { kind: 'message.mock' }> =>
        op.kind === 'message.mock' && op.payload.invoiceId === invoiceId,
    )
    .map((op) => ({
      id: op.id,
      at: op.at,
      daysOverdue: op.payload.daysOverdue,
      outstandingSatang: op.payload.outstandingSatang,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Overdue invoices (sent or part-paid, past their due date), most days late first. The late fee is the one the
 * building's plan would charge today. Rows carry the reminders already sent.
 */
export function overdueList(data: Data, ops: Op[], today: string, asOf: Date) {
  return data.invoice
    .filter((i) => OPEN_STATUSES.includes(i.status) && i.dueDate < today)
    .map((i) => {
      const contract = data.contract.find((c) => c.id === i.contractId);
      const room = contract && data.room.find((r) => r.id === contract.roomId);
      const primary =
        contract &&
        data.contract_renter.find(
          (cr) => cr.contractId === contract.id && cr.isPrimary,
        );
      const renter =
        primary && data.renter.find((r) => r.id === primary.renterId);
      const plan = ratePlanOn(
        data.rate_plan.filter((p) => p.buildingId === i.buildingId),
        i.dueDate,
      );
      const rule = plan ? ratesOf(plan).lateFee : null;
      return {
        id: i.id,
        number: i.number,
        roomNumber: room?.number ?? '',
        renterName: renter?.name ?? null,
        dueDate: i.dueDate,
        daysLate: daysLate(i.dueDate, asOf),
        outstandingSatang: balanceOf(data, i),
        lateFeeSatang: rule ? lateFee(rule, i.dueDate, asOf) : 0,
        reminders: remindersFor(ops, i.id),
        contractId: i.contractId,
      };
    })
    .sort(
      (a, b) => b.daysLate - a.daysLate || a.number.localeCompare(b.number),
    );
}
