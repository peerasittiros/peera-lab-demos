import type { Data, Role, Row, TableName } from './schema';
import { balanceOf, creditedOn } from './settlement';

/**
 * Visitor changes (SPEC §2.2). Each op is an event the visitor caused, with the results already worked out by the
 * command (allocations, receipt number), so replaying an op never recomputes anything. `canApply` and `apply` are
 * pure: the same ops replayed over the same snapshot always give the same data.
 */

export type OpBase = { id: string; at: string; role: Role };

/** Which slip image the tenant attached: the built-in sample, an upload (kept only in this session), or none. */
export type SlipKind = 'sample' | 'uploaded' | null;

export type Allocation = { invoiceId: string; amount: number };

type Receipt = {
  buildingId: string;
  docType: string;
  year: number;
  /** The sequence number the receipt used; the next free number is one more. */
  sequence: number;
  receiptNumber: string;
};

export type SlipSubmitOp = OpBase & {
  kind: 'slip.submit';
  payload: {
    paymentId: string;
    contractId: string;
    amountSatang: number;
    slipUrl: SlipKind;
    paidAt: string;
  };
};

export type PaymentApproveOp = OpBase & {
  kind: 'payment.approve';
  payload: Receipt & {
    paymentId: string;
    amountSatang: number;
    reviewedBy: string;
    allocations: Allocation[];
  };
};

/** Cash or transfer the owner recorded: approved at once, with its own receipt. */
export type PaymentRecordOp = OpBase & {
  kind: 'payment.record';
  payload: Receipt & {
    paymentId: string;
    contractId: string;
    amountSatang: number;
    method: 'cash' | 'transfer';
    paidAt: string;
    reviewedBy: string;
    allocations: Allocation[];
  };
};

export type PaymentRejectOp = OpBase & {
  kind: 'payment.reject';
  payload: { paymentId: string; reason: string; reviewedBy: string };
};

/** One meter reading, as the caretaker or owner entered it, with its units and anomaly worked out. */
export type MeterReadOp = OpBase & {
  kind: 'meter.read';
  payload: {
    readingId: string;
    roomId: string;
    meterKind: 'electricity' | 'water';
    period: string;
    reading: number;
    isRollover: boolean;
    unitsUsed: number | null;
    anomaly: string | null;
    readBy: string;
    readAt: string;
  };
};

/** A line of an invoice, as stored. Lines are replaced whole when a draft is adjusted. */
export type LineRecord = {
  id: string;
  kind: string;
  labelTh: string;
  labelEn: string;
  amountSatang: number;
  meta: Record<string, unknown>;
};

/** One month's draft invoices, numbered from the building's `INV` sequence. */
export type BillingGenerateOp = OpBase & {
  kind: 'billing.generate';
  payload: {
    buildingId: string;
    docType: string;
    year: number;
    /** The first sequence number used; the invoices take consecutive numbers from here. */
    sequence: number;
    invoices: {
      id: string;
      contractId: string;
      number: string;
      period: string;
      issueDate: string;
      dueDate: string;
      subtotalSatang: number;
      totalSatang: number;
      publicToken: string;
      lines: LineRecord[];
    }[];
  };
};

/** The lines of a draft after the owner's adjustments (added, edited or removed lines). */
export type InvoiceLinesOp = OpBase & {
  kind: 'invoice.lines';
  payload: {
    invoiceId: string;
    subtotalSatang: number;
    totalSatang: number;
    lines: LineRecord[];
  };
};

/** Sends drafts: they become sent, and from here on they are immutable. */
export type BillingSendOp = OpBase & {
  kind: 'billing.send';
  payload: { invoiceIds: string[]; sentAt: string };
};

/** Voids a draft. A sent invoice can't be voided; it is corrected with a credit note. */
export type InvoiceVoidOp = OpBase & {
  kind: 'invoice.void';
  payload: { invoiceId: string };
};

/** A repair request from a tenant (or the owner on their behalf). Starts `new` on the board. */
export type RepairCreateOp = OpBase & {
  kind: 'repair.create';
  payload: {
    ticketId: string;
    roomId: string;
    roomNumber: string;
    renterId: string | null;
    category: string;
    description: string;
    preferredTime: string;
    allowEntry: boolean;
    messageId: string;
  };
};

/** A ticket's status, assignee, schedule, cost and billing choice, as the owner set them. */
export type RepairUpdateOp = OpBase & {
  kind: 'repair.update';
  payload: {
    ticketId: string;
    status: string;
    assignee: string | null;
    scheduledAt: string | null;
    costSatang: number | null;
    billToRenter: boolean;
    closedAt: string | null;
  };
};

/** A message on a ticket's timeline. */
export type RepairNoteOp = OpBase & {
  kind: 'repair.note';
  payload: {
    messageId: string;
    ticketId: string;
    authorRole: string;
    body: string;
  };
};

/** A reminder about an overdue invoice. Nothing is sent; it appears in the tenant's chat preview. */
export type MessageMockOp = OpBase & {
  kind: 'message.mock';
  payload: {
    messageId: string;
    invoiceId: string;
    daysOverdue: number;
    outstandingSatang: number;
    dueDate: string;
  };
};

export type AnnouncementPostOp = OpBase & {
  kind: 'announcement.post';
  payload: {
    announcementId: string;
    buildingId: string;
    titleTh: string;
    titleEn: string;
    bodyTh: string;
    bodyEn: string;
    publishedAt: string;
  };
};

export type RoomMaintenanceOp = OpBase & {
  kind: 'room.maintenance';
  payload: { roomId: string; maintenance: boolean };
};

export type ContractNoticeOp = OpBase & {
  kind: 'contract.notice';
  payload: { contractId: string; noticeDate: string };
};

export type ChecklistRecord = {
  key: string;
  labelTh: string;
  labelEn: string;
  status: 'ok' | 'damaged' | null;
};

/** Move-in: renter, contract, starting meters, checklist and the first invoice, in one op. */
export type ContractMoveInOp = OpBase & {
  kind: 'contract.movein';
  payload: {
    contractId: string;
    roomId: string;
    renter: { id: string; isNew: boolean; name: string; phone: string | null };
    startDate: string;
    monthlyRentSatang: number;
    depositSatang: number;
    advanceMonths: number;
    occupants: number;
    extras: { parking: number; internet: number };
    period: string;
    readings: {
      electricity: { id: string; reading: number };
      water: { id: string; reading: number };
    };
    checklist: ChecklistRecord[];
    invoice: {
      id: string;
      number: string;
      buildingId: string;
      docType: string;
      year: number;
      sequence: number;
      issueDate: string;
      dueDate: string;
      subtotalSatang: number;
      totalSatang: number;
      publicToken: string;
      lines: LineRecord[];
    };
  };
};

export type ContractMoveOutOp = OpBase & {
  kind: 'contract.moveout';
  payload: {
    contractId: string;
    roomId: string;
    moveOutDate: string;
    readings: {
      electricity: { id: string; reading: number; unitsUsed: number };
      water: { id: string; reading: number; unitsUsed: number };
    };
    period: string;
    checklist: ChecklistRecord[];
    settlement: {
      id: string;
      depositSatang: number;
      deductions: {
        key: string;
        labelTh: string;
        labelEn: string;
        amountSatang: number;
      }[];
      refundSatang: number;
    };
  };
};

/** Edits a building's names, PromptPay ID and billing days. Bills already issued keep what they were issued with. */
export type BuildingUpdateOp = OpBase & {
  kind: 'building.update';
  payload: {
    buildingId: string;
    nameTh: string;
    nameEn: string | null;
    promptpayId: string;
    billingDay: number;
    dueDay: number;
  };
};

/** A new rate plan from `validFrom`. Bills generated before that date keep the plan they were generated with. */
export type RatePlanAddOp = OpBase & {
  kind: 'rate_plan.add';
  payload: Omit<Row<'rate_plan'>, 'createdAt'>;
};

/**
 * A credit note against a sent invoice. It takes `amountSatang` off what the invoice still owes; the invoice itself is
 * not changed (SPEC §4 O11).
 */
export type CreditNoteIssueOp = OpBase & {
  kind: 'credit_note.issue';
  payload: {
    creditNoteId: string;
    invoiceId: string;
    number: string;
    amountSatang: number;
    reason: string;
  };
};

export type Op =
  | SlipSubmitOp
  | PaymentApproveOp
  | PaymentRecordOp
  | PaymentRejectOp
  | MeterReadOp
  | BillingGenerateOp
  | InvoiceLinesOp
  | BillingSendOp
  | InvoiceVoidOp
  | RepairCreateOp
  | RepairUpdateOp
  | RepairNoteOp
  | MessageMockOp
  | AnnouncementPostOp
  | RoomMaintenanceOp
  | ContractNoticeOp
  | ContractMoveInOp
  | ContractMoveOutOp
  | BuildingUpdateOp
  | RatePlanAddOp
  | CreditNoteIssueOp
  | RoomUpdateOp;

/** Edits a room's number, floor, type, size and meter digit counts. The room keeps its building. */
export type RoomUpdateOp = OpBase & {
  kind: 'room.update';
  payload: {
    roomId: string;
    number: string;
    floor: number;
    roomTypeId: string;
    sizeSqm: number | null;
    elecMeterDigits: number;
    waterMeterDigits: number;
  };
};

export type OpKind = Op['kind'];

const byId = <T extends { id: string }>(rows: T[], id: string) =>
  rows.find((row) => row.id === id);

const allInvoicesExist = (data: Data, allocations: Allocation[]) =>
  allocations.every((a) => byId(data.invoice, a.invoiceId));

/** False when the op no longer fits the data (its rows are gone, or it was already applied). Such ops are skipped. */
export function canApply(data: Data, op: Op): boolean {
  switch (op.kind) {
    case 'slip.submit': {
      const { paymentId, contractId } = op.payload;
      return (
        !byId(data.payment, paymentId) &&
        Boolean(byId(data.contract, contractId))
      );
    }
    case 'payment.approve': {
      const payment = byId(data.payment, op.payload.paymentId);
      return (
        payment?.status === 'pending_review' &&
        allInvoicesExist(data, op.payload.allocations)
      );
    }
    case 'payment.record': {
      return (
        !byId(data.payment, op.payload.paymentId) &&
        Boolean(byId(data.contract, op.payload.contractId)) &&
        allInvoicesExist(data, op.payload.allocations)
      );
    }
    case 'payment.reject': {
      const payment = byId(data.payment, op.payload.paymentId);
      return payment?.status === 'pending_review';
    }
    case 'building.update':
      return Boolean(byId(data.building, op.payload.buildingId));
    case 'rate_plan.add':
      return (
        Boolean(byId(data.building, op.payload.buildingId)) &&
        !byId(data.rate_plan, op.payload.id) &&
        !data.rate_plan.some(
          (p) =>
            p.buildingId === op.payload.buildingId &&
            p.validFrom === op.payload.validFrom,
        )
      );
    case 'credit_note.issue': {
      const invoice = byId(data.invoice, op.payload.invoiceId);
      return (
        Boolean(invoice) &&
        (invoice!.status === 'sent' || invoice!.status === 'partially_paid') &&
        Number.isInteger(op.payload.amountSatang) &&
        op.payload.amountSatang > 0 &&
        op.payload.amountSatang <= balanceOf(data, invoice!) &&
        !byId(data.credit_note, op.payload.creditNoteId) &&
        !data.credit_note.some((c) => c.number === op.payload.number)
      );
    }
    case 'meter.read':
      return (
        Boolean(byId(data.room, op.payload.roomId)) &&
        !byId(data.meter_reading, op.payload.readingId)
      );
    case 'billing.generate':
      return (
        Boolean(byId(data.building, op.payload.buildingId)) &&
        op.payload.invoices.every(
          (inv) =>
            !byId(data.invoice, inv.id) &&
            Boolean(byId(data.contract, inv.contractId)) &&
            !data.invoice.some((existing) => existing.number === inv.number),
        )
      );
    case 'invoice.lines': {
      const invoice = byId(data.invoice, op.payload.invoiceId);
      return invoice?.status === 'draft';
    }
    case 'billing.send':
      return op.payload.invoiceIds.every(
        (id) => byId(data.invoice, id)?.status === 'draft',
      );
    case 'invoice.void':
      return byId(data.invoice, op.payload.invoiceId)?.status === 'draft';
    case 'repair.create':
      return (
        !byId(data.repair_ticket, op.payload.ticketId) &&
        Boolean(byId(data.room, op.payload.roomId))
      );
    case 'repair.update':
      return Boolean(byId(data.repair_ticket, op.payload.ticketId));
    case 'repair.note':
      return (
        Boolean(byId(data.repair_ticket, op.payload.ticketId)) &&
        !byId(data.ticket_message, op.payload.messageId)
      );
    case 'message.mock':
      return Boolean(byId(data.invoice, op.payload.invoiceId));
    case 'announcement.post':
      return (
        Boolean(byId(data.building, op.payload.buildingId)) &&
        !byId(data.announcement, op.payload.announcementId)
      );
    case 'room.maintenance':
      return Boolean(byId(data.room, op.payload.roomId));
    case 'room.update': {
      const room = byId(data.room, op.payload.roomId);
      const type = byId(data.room_type, op.payload.roomTypeId);
      return (
        Boolean(room) &&
        Boolean(type) &&
        type!.buildingId === room!.buildingId &&
        !data.room.some(
          (r) =>
            r.id !== op.payload.roomId &&
            r.buildingId === room!.buildingId &&
            r.number === op.payload.number,
        )
      );
    }
    case 'contract.notice':
      return byId(data.contract, op.payload.contractId)?.status === 'active';
    case 'contract.movein': {
      const p = op.payload;
      const liveOnRoom = data.contract.some(
        (c) => c.roomId === p.roomId && c.status !== 'ended',
      );
      return (
        Boolean(byId(data.room, p.roomId)) &&
        !liveOnRoom &&
        !byId(data.contract, p.contractId) &&
        (p.renter.isNew || Boolean(byId(data.renter, p.renter.id))) &&
        !data.invoice.some((i) => i.number === p.invoice.number)
      );
    }
    case 'contract.moveout': {
      const contract = byId(data.contract, op.payload.contractId);
      return (
        Boolean(contract) &&
        contract?.status !== 'ended' &&
        !data.settlement.some((st) => st.contractId === op.payload.contractId)
      );
    }
  }
}

function replaceRows<T extends TableName>(
  data: Data,
  name: T,
  next: Row<T>[],
): Data {
  return { ...data, [name]: next } as Data;
}

function patchRow<T extends TableName>(
  data: Data,
  name: T,
  id: string,
  patch: Partial<Row<T>>,
): Data {
  const rows = data[name] as (Row<T> & { id?: string })[];
  return replaceRows(
    data,
    name,
    rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
  );
}

/** Records the allocations and moves each invoice's paid amount and status forward. */
function settle(
  data: Data,
  paymentId: string,
  allocations: Allocation[],
  at: string,
): Data {
  let next = data;
  for (const allocation of allocations) {
    next = replaceRows(next, 'payment_allocation', [
      ...next.payment_allocation,
      {
        paymentId,
        invoiceId: allocation.invoiceId,
        amountSatang: allocation.amount,
        createdAt: at,
      },
    ]);
    const invoice = byId(next.invoice, allocation.invoiceId)!;
    const paid = invoice.paidSatang + allocation.amount;
    const settled = paid + creditedOn(next, invoice.id) >= invoice.totalSatang;
    next = patchRow(next, 'invoice', invoice.id, {
      paidSatang: paid,
      status: settled ? 'paid' : 'partially_paid',
    });
  }
  return next;
}

/** The next free receipt number for the building and year is one more than the one just used. */
function bumpSequence(data: Data, receipt: Receipt, at: string): Data {
  const key = (row: Row<'doc_sequence'>) =>
    row.buildingId === receipt.buildingId &&
    row.docType === receipt.docType &&
    row.year === receipt.year;
  const nextNo = receipt.sequence + 1;
  return data.doc_sequence.some(key)
    ? replaceRows(
        data,
        'doc_sequence',
        data.doc_sequence.map((row) => (key(row) ? { ...row, nextNo } : row)),
      )
    : replaceRows(data, 'doc_sequence', [
        ...data.doc_sequence,
        {
          buildingId: receipt.buildingId,
          docType: receipt.docType,
          year: receipt.year,
          nextNo,
          createdAt: at,
        },
      ]);
}

/** Sets the room's reading for a meter and period, replacing one already on file for that period. */
function upsertReading(
  data: Data,
  roomId: string,
  kind: 'electricity' | 'water',
  period: string,
  id: string,
  reading: number,
  unitsUsed: number | null,
  at: string,
  readBy: string,
): Data {
  const existing = data.meter_reading.find(
    (r) => r.roomId === roomId && r.kind === kind && r.period === period,
  );
  const values = {
    reading,
    unitsUsed,
    isRollover: false,
    anomaly: null,
    readBy,
    readAt: at,
  };
  if (existing) return patchRow(data, 'meter_reading', existing.id, values);
  const row: Row<'meter_reading'> = {
    id,
    roomId,
    kind,
    period,
    isEstimate: false,
    photoUrl: null,
    createdAt: at,
    ...values,
  };
  return replaceRows(data, 'meter_reading', [...data.meter_reading, row]);
}

/** Applies a checked op. Call `canApply` first. */
export function apply(data: Data, op: Op): Data {
  switch (op.kind) {
    case 'slip.submit': {
      const { paymentId, contractId, amountSatang, slipUrl, paidAt } =
        op.payload;
      const created: Row<'payment'> = {
        id: paymentId,
        contractId,
        amountSatang,
        method: 'promptpay',
        paidAt,
        slipUrl,
        status: 'pending_review',
        reviewedBy: null,
        rejectReason: null,
        receiptNumber: null,
        createdAt: op.at,
      };
      return replaceRows(data, 'payment', [...data.payment, created]);
    }

    case 'payment.approve': {
      const {
        paymentId,
        amountSatang,
        reviewedBy,
        receiptNumber,
        allocations,
      } = op.payload;
      let next = patchRow(data, 'payment', paymentId, {
        status: 'approved',
        amountSatang,
        reviewedBy,
        receiptNumber,
      });
      next = settle(next, paymentId, allocations, op.at);
      return bumpSequence(next, op.payload, op.at);
    }

    case 'payment.record': {
      const {
        paymentId,
        contractId,
        amountSatang,
        method,
        paidAt,
        reviewedBy,
        receiptNumber,
        allocations,
      } = op.payload;
      const created: Row<'payment'> = {
        id: paymentId,
        contractId,
        amountSatang,
        method,
        paidAt,
        slipUrl: null,
        status: 'approved',
        reviewedBy,
        rejectReason: null,
        receiptNumber,
        createdAt: op.at,
      };
      let next = replaceRows(data, 'payment', [...data.payment, created]);
      next = settle(next, paymentId, allocations, op.at);
      return bumpSequence(next, op.payload, op.at);
    }

    case 'meter.read': {
      const p = op.payload;
      const existing = data.meter_reading.find(
        (r) =>
          r.roomId === p.roomId &&
          r.kind === p.meterKind &&
          r.period === p.period,
      );
      const values = {
        reading: p.reading,
        unitsUsed: p.unitsUsed,
        isRollover: p.isRollover,
        anomaly: p.anomaly,
        readBy: p.readBy,
        readAt: p.readAt,
      };
      if (existing) return patchRow(data, 'meter_reading', existing.id, values);
      const created: Row<'meter_reading'> = {
        id: p.readingId,
        roomId: p.roomId,
        kind: p.meterKind,
        period: p.period,
        isEstimate: false,
        photoUrl: null,
        createdAt: op.at,
        ...values,
      };
      return replaceRows(data, 'meter_reading', [
        ...data.meter_reading,
        created,
      ]);
    }

    case 'billing.generate': {
      const p = op.payload;
      let next = data;
      for (const inv of p.invoices) {
        next = replaceRows(next, 'invoice', [
          ...next.invoice,
          {
            id: inv.id,
            buildingId: p.buildingId,
            contractId: inv.contractId,
            number: inv.number,
            type: 'monthly',
            period: inv.period,
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            status: 'draft',
            subtotalSatang: inv.subtotalSatang,
            totalSatang: inv.totalSatang,
            paidSatang: 0,
            sentAt: null,
            publicToken: inv.publicToken,
            createdAt: op.at,
          },
        ]);
        next = replaceRows(next, 'invoice_line', [
          ...next.invoice_line,
          ...inv.lines.map((line) => ({
            ...line,
            invoiceId: inv.id,
            qty: 1,
            unitPriceSatang: line.amountSatang,
            createdAt: op.at,
          })),
        ]);
      }
      return bumpSequence(
        next,
        {
          buildingId: p.buildingId,
          docType: p.docType,
          year: p.year,
          sequence: p.sequence + p.invoices.length - 1,
          receiptNumber: '',
        },
        op.at,
      );
    }

    case 'invoice.lines': {
      const p = op.payload;
      let next = replaceRows(
        data,
        'invoice_line',
        data.invoice_line.filter((l) => l.invoiceId !== p.invoiceId),
      );
      next = replaceRows(next, 'invoice_line', [
        ...next.invoice_line,
        ...p.lines.map((line) => ({
          ...line,
          invoiceId: p.invoiceId,
          qty: 1,
          unitPriceSatang: line.amountSatang,
          createdAt: op.at,
        })),
      ]);
      return patchRow(next, 'invoice', p.invoiceId, {
        subtotalSatang: p.subtotalSatang,
        totalSatang: p.totalSatang,
      });
    }

    case 'billing.send': {
      let next = data;
      for (const id of op.payload.invoiceIds) {
        next = patchRow(next, 'invoice', id, {
          status: 'sent',
          sentAt: op.payload.sentAt,
        });
      }
      return next;
    }

    case 'invoice.void':
      return patchRow(data, 'invoice', op.payload.invoiceId, {
        status: 'void',
      });

    case 'repair.create': {
      const p = op.payload;
      const ticket: Row<'repair_ticket'> = {
        id: p.ticketId,
        roomId: p.roomId,
        renterId: p.renterId,
        category: p.category,
        description: p.description,
        photoUrl: null,
        preferredTime: p.preferredTime,
        allowEntry: p.allowEntry,
        status: 'new',
        assignee: null,
        scheduledAt: null,
        costSatang: null,
        billToRenter: false,
        closedAt: null,
        createdAt: op.at,
      };
      const message: Row<'ticket_message'> = {
        id: p.messageId,
        ticketId: p.ticketId,
        authorRole: op.role,
        body: p.description,
        at: op.at,
        createdAt: op.at,
      };
      const withTicket = replaceRows(data, 'repair_ticket', [
        ...data.repair_ticket,
        ticket,
      ]);
      return replaceRows(withTicket, 'ticket_message', [
        ...withTicket.ticket_message,
        message,
      ]);
    }

    case 'repair.update': {
      const p = op.payload;
      return patchRow(data, 'repair_ticket', p.ticketId, {
        status: p.status,
        assignee: p.assignee,
        scheduledAt: p.scheduledAt,
        costSatang: p.costSatang,
        billToRenter: p.billToRenter,
        closedAt: p.closedAt,
      });
    }

    case 'repair.note': {
      const p = op.payload;
      const message: Row<'ticket_message'> = {
        id: p.messageId,
        ticketId: p.ticketId,
        authorRole: p.authorRole,
        body: p.body,
        at: op.at,
        createdAt: op.at,
      };
      return replaceRows(data, 'ticket_message', [
        ...data.ticket_message,
        message,
      ]);
    }

    case 'message.mock':
      // Reminders live in the op log; the chat preview and the overdue list read them from there.
      return data;

    case 'announcement.post': {
      const p = op.payload;
      const row: Row<'announcement'> = {
        id: p.announcementId,
        buildingId: p.buildingId,
        titleTh: p.titleTh,
        titleEn: p.titleEn,
        bodyTh: p.bodyTh,
        bodyEn: p.bodyEn,
        publishedAt: p.publishedAt,
        expiresAt: null,
        createdAt: op.at,
      };
      return replaceRows(data, 'announcement', [...data.announcement, row]);
    }

    case 'room.maintenance':
      return patchRow(data, 'room', op.payload.roomId, {
        maintenance: op.payload.maintenance,
      });
    case 'room.update': {
      const p = op.payload;
      return patchRow(data, 'room', p.roomId, {
        number: p.number,
        floor: p.floor,
        roomTypeId: p.roomTypeId,
        sizeSqm: p.sizeSqm,
        elecMeterDigits: p.elecMeterDigits,
        waterMeterDigits: p.waterMeterDigits,
      });
    }

    case 'contract.notice':
      return patchRow(data, 'contract', op.payload.contractId, {
        status: 'notice_given',
        noticeDate: op.payload.noticeDate,
      });

    case 'contract.movein': {
      const p = op.payload;
      let next = data;
      if (p.renter.isNew) {
        next = replaceRows(next, 'renter', [
          ...next.renter,
          {
            id: p.renter.id,
            name: p.renter.name,
            phone: p.renter.phone,
            lineUserId: null,
            preferredLocale: 'th',
            emergencyContact: null,
            note: null,
            createdAt: op.at,
          },
        ]);
      }
      next = replaceRows(next, 'contract', [
        ...next.contract,
        {
          id: p.contractId,
          roomId: p.roomId,
          startDate: p.startDate,
          endDate: null,
          noticeDate: null,
          status: 'active',
          monthlyRentSatang: p.monthlyRentSatang,
          depositSatang: p.depositSatang,
          depositReceivedSatang: p.depositSatang,
          advanceMonths: p.advanceMonths,
          occupants: p.occupants,
          extras: p.extras,
          note: null,
          createdAt: op.at,
        },
      ]);
      next = replaceRows(next, 'contract_renter', [
        ...next.contract_renter,
        {
          contractId: p.contractId,
          renterId: p.renter.id,
          isPrimary: true,
          createdAt: op.at,
        },
      ]);
      next = upsertReading(
        next,
        p.roomId,
        'electricity',
        p.period,
        p.readings.electricity.id,
        p.readings.electricity.reading,
        null,
        op.at,
        'move-in',
      );
      next = upsertReading(
        next,
        p.roomId,
        'water',
        p.period,
        p.readings.water.id,
        p.readings.water.reading,
        null,
        op.at,
        'move-in',
      );
      next = replaceRows(next, 'checklist', [
        ...next.checklist,
        {
          id: `${p.contractId}-move_in`,
          contractId: p.contractId,
          kind: 'move_in',
          items: p.checklist,
          completedAt: op.at,
          createdAt: op.at,
        },
      ]);
      const inv = p.invoice;
      next = replaceRows(next, 'invoice', [
        ...next.invoice,
        {
          id: inv.id,
          buildingId: inv.buildingId,
          contractId: p.contractId,
          number: inv.number,
          type: 'move_in',
          period: p.period,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          status: 'sent',
          subtotalSatang: inv.subtotalSatang,
          totalSatang: inv.totalSatang,
          paidSatang: 0,
          sentAt: op.at,
          publicToken: inv.publicToken,
          createdAt: op.at,
        },
      ]);
      next = replaceRows(next, 'invoice_line', [
        ...next.invoice_line,
        ...inv.lines.map((line) => ({
          ...line,
          invoiceId: inv.id,
          qty: 1,
          unitPriceSatang: line.amountSatang,
          createdAt: op.at,
        })),
      ]);
      return bumpSequence(
        next,
        {
          buildingId: inv.buildingId,
          docType: inv.docType,
          year: inv.year,
          sequence: inv.sequence,
          receiptNumber: '',
        },
        op.at,
      );
    }

    case 'contract.moveout': {
      const p = op.payload;
      let next = upsertReading(
        data,
        p.roomId,
        'electricity',
        p.period,
        p.readings.electricity.id,
        p.readings.electricity.reading,
        p.readings.electricity.unitsUsed,
        op.at,
        'move-out',
      );
      next = upsertReading(
        next,
        p.roomId,
        'water',
        p.period,
        p.readings.water.id,
        p.readings.water.reading,
        p.readings.water.unitsUsed,
        op.at,
        'move-out',
      );
      next = replaceRows(next, 'checklist', [
        ...next.checklist,
        {
          id: `${p.contractId}-move_out`,
          contractId: p.contractId,
          kind: 'move_out',
          items: p.checklist,
          completedAt: op.at,
          createdAt: op.at,
        },
      ]);
      next = replaceRows(next, 'settlement', [
        ...next.settlement,
        {
          id: p.settlement.id,
          contractId: p.contractId,
          depositSatang: p.settlement.depositSatang,
          deductions: p.settlement.deductions,
          refundSatang: p.settlement.refundSatang,
          settledAt: op.at,
          createdAt: op.at,
        },
      ]);
      return patchRow(next, 'contract', p.contractId, {
        status: 'ended',
        endDate: p.moveOutDate,
      });
    }
    case 'payment.reject':
      return patchRow(data, 'payment', op.payload.paymentId, {
        status: 'rejected',
        rejectReason: op.payload.reason,
        reviewedBy: op.payload.reviewedBy,
      });
    case 'building.update': {
      const p = op.payload;
      return patchRow(data, 'building', p.buildingId, {
        nameTh: p.nameTh,
        nameEn: p.nameEn,
        promptpayId: p.promptpayId,
        billingDay: p.billingDay,
        dueDay: p.dueDay,
      });
    }
    case 'rate_plan.add': {
      const row: Row<'rate_plan'> = { ...op.payload, createdAt: op.at };
      return replaceRows(data, 'rate_plan', [...data.rate_plan, row]);
    }
    case 'credit_note.issue': {
      const p = op.payload;
      const note: Row<'credit_note'> = {
        id: p.creditNoteId,
        invoiceId: p.invoiceId,
        number: p.number,
        amountSatang: p.amountSatang,
        reason: p.reason,
        createdAt: op.at,
      };
      const withNote = replaceRows(data, 'credit_note', [
        ...data.credit_note,
        note,
      ]);
      const invoice = byId(withNote.invoice, p.invoiceId)!;
      return patchRow(withNote, 'invoice', invoice.id, {
        status: balanceOf(withNote, invoice) <= 0 ? 'paid' : invoice.status,
      });
    }
  }
}
