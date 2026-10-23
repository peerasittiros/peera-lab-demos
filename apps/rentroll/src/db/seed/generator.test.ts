import { describe, expect, it } from 'vitest';
import { buildSeed } from './generator';

const seed = buildSeed();
const DAY = 86_400_000;

describe('rentroll seed (01 §9)', () => {
  it('has 2 buildings and 44 rooms', () => {
    expect(seed.buildings).toHaveLength(2);
    expect(seed.rooms).toHaveLength(44);
  });

  it('has 5 rooms with no contract (3 vacant, 2 maintenance) and 1 reserved room with a future contract', () => {
    const empty = seed.rooms.filter(
      (r) => !seed.contracts.some((c) => c.roomId === r.id && c.status !== 'ended'),
    );
    expect(empty).toHaveLength(5);
    expect(seed.contracts.filter((c) => c.status === 'active' && c.startDaysAgo! < 0)).toHaveLength(1);
    expect(seed.rooms.filter((r) => r.maintenance)).toHaveLength(2);
  });

  it('has 2 notice-given contracts', () => {
    expect(seed.contracts.filter((c) => c.status === 'notice_given')).toHaveLength(2);
  });

  it('has 4 overdue invoices, one past 40 days', () => {
    const unpaid = seed.invoices.filter((i) => i.status === 'sent');
    const overdue = unpaid.filter((i) => (i.dueDate as string) < '2026-10-23');
    expect(overdue).toHaveLength(4);
    const oldest = Math.max(
      ...overdue.map((i) => (Date.UTC(2026, 9, 23) - new Date(i.dueDate as string).getTime()) / DAY),
    );
    expect(oldest).toBeGreaterThan(40);
  });

  it('has A-305 bill due in 4 days', () => {
    const room = seed.rooms.find((r) => r.number === 'A-305');
    const contract = seed.contracts.find((c) => c.roomId === room!.id);
    const bill = seed.invoices.find(
      (i) => i.contractId === contract!.id && i.status === 'sent' && i.daysAgo === 3,
    );
    expect(bill).toBeDefined();
    const dueIn = (new Date(bill!.dueDate as string).getTime() - Date.UTC(2026, 9, 23)) / DAY;
    expect(dueIn).toBe(4);
  });

  it('keeps every invoice total equal to its line sum', () => {
    for (const inv of seed.invoices) {
      const sum = seed.invoiceLines
        .filter((l) => l.invoiceId === inv.id)
        .reduce((s, l) => s + l.amountSatang, 0);
      expect(inv.totalSatang).toBe(sum);
    }
  });

  it('gives every public invoice token a unique value', () => {
    const tokens = seed.invoices.map((i) => i.publicToken);
    expect(new Set(tokens).size).toBe(tokens.length);
  });
});
