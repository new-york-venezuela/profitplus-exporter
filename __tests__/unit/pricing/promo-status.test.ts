import { describe, test, expect } from 'bun:test';
import { promotionStatus } from '@/lib/pricing/promo-status';

const p = { startsOn: '2026-10-05', endsOn: '2026-10-15', cancelledAt: null };

describe('promotionStatus', () => {
  test('boundaries are inclusive', () => {
    expect(promotionStatus(p, '2026-10-04')).toBe('scheduled');
    expect(promotionStatus(p, '2026-10-05')).toBe('active');
    expect(promotionStatus(p, '2026-10-15')).toBe('active');
    expect(promotionStatus(p, '2026-10-16')).toBe('ended');
  });
  test('cancelled wins', () => expect(promotionStatus({ ...p, cancelledAt: 1 }, '2026-10-09')).toBe('cancelled'));
});
