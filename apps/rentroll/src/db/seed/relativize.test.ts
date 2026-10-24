import { describe, expect, it } from 'vitest';
import { buildSeed } from './generator';
import {
  bangkokInstant,
  daysAgoDate,
  periodFor,
  relativizeSeed,
} from './relativize';

const TODAY = '2026-10-24';

describe('periodFor (rentroll.period_for)', () => {
  it('turns ~mNN into the month NN months before today', () => {
    expect(periodFor('~m00', TODAY)).toBe('2026-10');
    expect(periodFor('~m01', TODAY)).toBe('2026-09');
    expect(periodFor('~m12', TODAY)).toBe('2025-10');
  });

  it('keeps fixed periods and null', () => {
    expect(periodFor('2026-07', TODAY)).toBe('2026-07');
    expect(periodFor(null, TODAY)).toBeNull();
  });
});

describe('bangkokInstant', () => {
  it('is a fixed Bangkok time of day (UTC+7)', () => {
    expect(bangkokInstant('2026-10-23', 10 * 60)).toBe(
      '2026-10-23T03:00:00.000Z',
    );
    expect(bangkokInstant('2026-10-23', 9 * 60)).toBe(
      '2026-10-23T02:00:00.000Z',
    );
  });
});

describe('daysAgoDate', () => {
  it('moves whole days across month ends', () => {
    expect(daysAgoDate(TODAY, 3)).toBe('2026-10-21');
    expect(daysAgoDate('2026-03-01', 1)).toBe('2026-02-28');
    expect(daysAgoDate(TODAY, -10)).toBe('2026-11-03');
  });
});

describe('relativizeSeed', () => {
  it('moves an invoice to days_ago and keeps its 7-day gap', () => {
    const [invoice] = relativizeSeed(
      {
        invoices: [
          {
            tenantId: 'x',
            period: '~m00',
            issueDate: '2020-01-01',
            dueDate: '2020-01-08',
            daysAgo: 3,
            sentAt: new Date('2020-01-01T00:00:00Z'),
            status: 'sent',
          },
        ],
      },
      TODAY,
    ).invoice!;
    expect(invoice).toMatchObject({
      period: '2026-10',
      issueDate: '2026-10-21',
      dueDate: '2026-10-28',
      sentAt: '2026-10-21T02:00:00.000Z',
      status: 'sent',
    });
    expect(invoice).not.toHaveProperty('daysAgo');
    expect(invoice).not.toHaveProperty('tenantId');
  });

  it('keeps a contract date when days_ago is null, and moves it when set', () => {
    const [kept, moved] = relativizeSeed(
      {
        contracts: [
          {
            startDate: '2025-01-01',
            startDaysAgo: null,
            endDate: null,
            endDaysAgo: null,
            noticeDate: null,
          },
          {
            startDate: '2020-01-01',
            startDaysAgo: 30,
            endDate: null,
            endDaysAgo: -10,
            noticeDate: null,
          },
        ],
      },
      TODAY,
    ).contract!;
    expect(kept!.startDate).toBe('2025-01-01');
    expect(moved!.startDate).toBe('2026-09-24');
    expect(moved!.endDate).toBe('2026-11-03');
  });

  it('uses minute_of_day for payments and defaults to 10:00', () => {
    const [late, normal] = relativizeSeed(
      {
        payments: [
          { paidAt: new Date(0), daysAgo: 1, minuteOfDay: 900 },
          { paidAt: new Date(0), daysAgo: 1, minuteOfDay: null },
        ],
      },
      TODAY,
    ).payment!;
    expect(late!.paidAt).toBe('2026-10-23T08:00:00.000Z');
    expect(normal!.paidAt).toBe('2026-10-23T03:00:00.000Z');
  });

  it('is deterministic for the same day', () => {
    const seed = buildSeed();
    expect(relativizeSeed(seed, TODAY)).toEqual(relativizeSeed(seed, TODAY));
  });

  it('resolves the whole template with no relative fields left', () => {
    const tables = relativizeSeed(buildSeed(), TODAY);
    const rows = Object.values(tables).flat() as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(1000);
    for (const row of rows) {
      expect(row).not.toHaveProperty('tenantId');
      expect(row).not.toHaveProperty('daysAgo');
      expect(row).not.toHaveProperty('minuteOfDay');
    }
    for (const invoice of tables.invoice ?? []) {
      expect(String(invoice.period)).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('has A-305 bill due in 4 days (issued 3 days ago)', () => {
    const tables = relativizeSeed(buildSeed(), TODAY);
    const due = (tables.invoice ?? []).filter(
      (i) => i.dueDate === '2026-10-28' && i.status === 'sent',
    );
    expect(due.length).toBeGreaterThanOrEqual(1);
  });
});
