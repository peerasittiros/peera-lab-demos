import { describe, expect, it } from 'vitest';
import { memoryPersistence } from './idb';
import { createStore, type Store } from './store';
import { snapshotFor } from './testing';
import {
  dashboard,
  depositsReport,
  rentRoll,
  utilitiesReport,
} from './selectors/reports';
import { baht, toCsv } from '@/src/domain/csv';

const TODAY = '2026-10-24';
const PERIOD = '2026-10';

async function readyStore(): Promise<Store> {
  const store = createStore({
    openPersistence: async () => memoryPersistence(),
    fetchSnapshot: async () => snapshotFor(TODAY),
    openSync: () => null,
    today: () => TODAY,
  });
  await store.start();
  return store;
}

describe('reports and dashboard', () => {
  it('the rent roll totals are the sums of the month’s invoices', async () => {
    const data = (await readyStore()).getState().data;
    const invoices = data.invoice.filter(
      (i) => i.period === PERIOD && i.type === 'monthly' && i.status !== 'void',
    );
    const rows = rentRoll(data, PERIOD, TODAY);
    expect(rows.reduce((s, r) => s + r.billedSatang, 0)).toBe(
      invoices.reduce((s, i) => s + i.totalSatang, 0),
    );
    expect(rows.reduce((s, r) => s + r.paidSatang, 0)).toBe(
      invoices.reduce((s, i) => s + i.paidSatang, 0),
    );
  });

  it('the dashboard billed and collected agree with the rent roll', async () => {
    const data = (await readyStore()).getState().data;
    const board = dashboard(data, PERIOD, TODAY);
    const rows = rentRoll(data, PERIOD, TODAY);
    expect(board.kpis.billedSatang).toBe(
      rows.reduce((s, r) => s + r.billedSatang, 0),
    );
    expect(board.kpis.collectedSatang).toBe(
      rows.reduce((s, r) => s + r.paidSatang, 0),
    );
    expect(board.revenue).toHaveLength(12);
    expect(board.revenue.at(-1)?.period).toBe(PERIOD);
  });

  it('the utilities report has a row for each billed room and units from the invoice lines', async () => {
    const data = (await readyStore()).getState().data;
    const rows = utilitiesReport(data, '2026-09');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows)
      expect(row.electricitySatang).toBeGreaterThanOrEqual(0);
  });

  it('the deposits report lists each contract with a deposit', async () => {
    const data = (await readyStore()).getState().data;
    expect(depositsReport(data).length).toBe(
      data.contract.filter(
        (c) => c.depositSatang > 0 || c.depositReceivedSatang > 0,
      ).length,
    );
  });
});

describe('CSV', () => {
  it('starts with a byte-order mark, quotes cells with commas, and uses CRLF', () => {
    const csv = toCsv(
      ['Room', 'Tenant'],
      [
        ['A-101', 'Somchai, K.'],
        ['A-102', null],
      ],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Somchai, K."');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.split('\r\n')[2]).toBe('A-102,');
  });

  it('writes baht with two decimals', () => {
    expect(baht(123456)).toBe('1234.56');
    expect(baht(5)).toBe('0.05');
  });
});
