import type { Queryable } from '@peera/db';
import { sql } from 'drizzle-orm';
import {
  announcement,
  building,
  contract,
  contractRenter,
  docSequence,
  invoice,
  invoiceLine,
  meterReading,
  payment,
  paymentAllocation,
  ratePlan,
  renter,
  repairTicket,
  room,
  roomType,
  ticketMessage,
} from '../schema';
import type { SeedData } from './generator';

const CHUNK = 500;

async function insertChunked<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
) {
  for (let start = 0; start < rows.length; start += CHUNK)
    await insert(rows.slice(start, start + CHUNK));
}

/** Replaces the template tenant with freshly generated rows. Run it inside a transaction. */
export async function insertSeed(tx: Queryable, data: SeedData) {
  await tx.execute(
    sql`select rentroll.delete_demo_tenant(${data.tenantId}::uuid)`,
  );
  await tx.insert(building).values(data.buildings);
  await tx.insert(ratePlan).values(data.ratePlans);
  await tx.insert(roomType).values(data.roomTypes);
  await insertChunked(data.rooms, (rows) => tx.insert(room).values(rows));
  await insertChunked(data.renters, (rows) => tx.insert(renter).values(rows));
  await insertChunked(data.contracts, (rows) =>
    tx.insert(contract).values(rows),
  );
  await tx.insert(contractRenter).values(data.contractRenters);
  await insertChunked(data.meterReadings, (rows) =>
    tx.insert(meterReading).values(rows),
  );
  await insertChunked(data.invoices, (rows) => tx.insert(invoice).values(rows));
  await insertChunked(data.invoiceLines, (rows) =>
    tx.insert(invoiceLine).values(rows),
  );
  await insertChunked(data.payments, (rows) => tx.insert(payment).values(rows));
  await insertChunked(data.paymentAllocations, (rows) =>
    tx.insert(paymentAllocation).values(rows),
  );
  await insertChunked(data.repairTickets, (rows) =>
    tx.insert(repairTicket).values(rows),
  );
  await insertChunked(data.ticketMessages, (rows) =>
    tx.insert(ticketMessage).values(rows),
  );
  await tx.insert(announcement).values(data.announcements);
  await tx.insert(docSequence).values(data.docSequences);
}
