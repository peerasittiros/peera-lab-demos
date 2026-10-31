import { describe, expect, it } from 'vitest';
import { markOf, type FloorPlanRoom } from './FloorPlan';

const room = (over: Partial<FloorPlanRoom>): FloorPlanRoom => ({
  roomId: 'r1',
  number: 'A-101',
  floor: 1,
  status: 'occupied',
  renterName: 'สมชาย ใจดี',
  daysPastDue: 0,
  notice: false,
  ...over,
});

describe('room tile marks (status by icon and word, never colour alone)', () => {
  it('leaves an occupied room in good standing unmarked', () => {
    expect(markOf(room({}), 'th')).toBeNull();
  });

  it('says vacant, reserved and closed for repair in words', () => {
    expect(markOf(room({ status: 'vacant' }), 'th')?.word).toBe('ว่าง');
    expect(markOf(room({ status: 'reserved' }), 'en')?.word).toBe('Reserved');
    expect(markOf(room({ status: 'maintenance' }), 'th')?.word).toBe('ปิดซ่อม');
  });

  it('puts overdue first, with the days, and counts in English', () => {
    const late = room({ daysPastDue: 25, notice: true });
    expect(markOf(late, 'th')?.word).toBe('ค้าง 25 วัน');
    expect(markOf(late, 'en')?.word).toBe('25 days overdue');
    expect(markOf(room({ daysPastDue: 1 }), 'en')?.word).toBe('1 day overdue');
    expect(markOf(late, 'th')?.tone).toBe('text-danger-ink');
  });

  it('marks a notice given when nothing is overdue', () => {
    expect(markOf(room({ notice: true }), 'en')?.word).toBe('Notice given');
  });
});
