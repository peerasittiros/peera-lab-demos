import type { Data } from '../schema';

/** Selectors for the owner's payment review (mirrors `src/db/queries/payments.ts`). Pure, like the tenant selectors. */

const OPEN_STATUSES = ['sent', 'partially_paid'];

/** The owner's review queue: slips waiting for a decision, each with the invoices it can settle. Oldest first. */
export function loadReviewQueue(data: Data) {
  const items = data.payment
    .filter((p) => p.status === 'pending_review')
    .flatMap((p) => {
      const contract = data.contract.find((c) => c.id === p.contractId);
      const room = contract && data.room.find((r) => r.id === contract.roomId);
      if (!contract || !room) return [];
      const primary = data.contract_renter.find(
        (cr) => cr.contractId === contract.id && cr.isPrimary,
      );
      const renterRow =
        primary && data.renter.find((r) => r.id === primary.renterId);
      const open = data.invoice
        .filter(
          (i) =>
            i.contractId === contract.id && OPEN_STATUSES.includes(i.status),
        )
        .map((i) => ({
          id: i.id,
          number: i.number,
          outstanding: i.totalSatang - i.paidSatang,
          dueDate: i.dueDate,
        }))
        .sort(
          (a, b) =>
            a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
        );
      return [
        {
          id: p.id,
          amountSatang: p.amountSatang,
          paidAt: p.paidAt,
          slipUrl: p.slipUrl,
          roomNumber: room.number,
          renterName: renterRow ? renterRow.name : null,
          open,
          owedSatang: open.reduce((sum, i) => sum + i.outstanding, 0),
        },
      ];
    });
  return items.sort((a, b) => a.paidAt.localeCompare(b.paidAt));
}
