import { describe, expect, it } from 'vitest';
import { ratePlanOn, roomStatus } from './property';

const today = '2026-10-23';

describe('roomStatus', () => {
  it('is vacant with no contract', () => {
    expect(roomStatus({ maintenance: false, contracts: [], today })).toBe(
      'vacant',
    );
  });

  it('is occupied with a started active contract, and while on notice', () => {
    const active = {
      status: 'active' as const,
      startDate: '2025-01-01',
      endDate: null,
    };
    const notice = {
      status: 'notice_given' as const,
      startDate: '2025-01-01',
      endDate: '2026-11-30',
    };
    expect(roomStatus({ maintenance: false, contracts: [active], today })).toBe(
      'occupied',
    );
    expect(roomStatus({ maintenance: false, contracts: [notice], today })).toBe(
      'occupied',
    );
  });

  it('is reserved when the only live contract starts later', () => {
    const future = {
      status: 'active' as const,
      startDate: '2026-11-15',
      endDate: null,
    };
    expect(roomStatus({ maintenance: false, contracts: [future], today })).toBe(
      'reserved',
    );
  });

  it('ignores ended contracts and contracts that finished before today', () => {
    const ended = {
      status: 'ended' as const,
      startDate: '2024-01-01',
      endDate: '2025-01-01',
    };
    const finished = {
      status: 'active' as const,
      startDate: '2024-01-01',
      endDate: '2026-10-01',
    };
    expect(
      roomStatus({ maintenance: false, contracts: [ended, finished], today }),
    ).toBe('vacant');
  });

  it('maintenance overrides any contract', () => {
    const active = {
      status: 'active' as const,
      startDate: '2025-01-01',
      endDate: null,
    };
    expect(roomStatus({ maintenance: true, contracts: [active], today })).toBe(
      'maintenance',
    );
  });
});

describe('ratePlanOn', () => {
  const plans = [
    { id: 'old', validFrom: '2025-01-01' },
    { id: 'new', validFrom: '2026-07-01' },
  ];

  it('picks the plan in force on the date', () => {
    expect(ratePlanOn(plans, '2025-06-30')?.id).toBe('old');
    expect(ratePlanOn(plans, '2026-07-01')?.id).toBe('new');
    expect(ratePlanOn(plans, '2026-10-23')?.id).toBe('new');
  });

  it('is null before the first plan', () => {
    expect(ratePlanOn(plans, '2024-12-31')).toBeNull();
  });

  it('does not depend on the order of the list', () => {
    expect(ratePlanOn([...plans].reverse(), '2026-08-01')?.id).toBe('new');
  });
});
