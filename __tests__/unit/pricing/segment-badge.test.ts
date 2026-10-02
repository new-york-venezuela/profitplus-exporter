import { describe, test, expect } from 'bun:test';
import { segmentBadge } from '@/app/(app)/pricing/segment-badge';

describe('segmentBadge', () => {
  test('group segments have no badge', () => expect(segmentBadge({ kind: 'group', daysLeft: null }).tone).toBe('none'));
  test('expired special', () => expect(segmentBadge({ kind: 'special', daysLeft: -3 })).toEqual({ label: 'vencida', tone: 'expired' }));
  test('today / soon / later', () => {
    expect(segmentBadge({ kind: 'special', daysLeft: 0 })).toEqual({ label: '⏳ hoy', tone: 'warn' });
    expect(segmentBadge({ kind: 'special', daysLeft: 7 })).toEqual({ label: '⏳ 7 d', tone: 'warn' });
    expect(segmentBadge({ kind: 'special', daysLeft: 8 })).toEqual({ label: '⏳ 8 d', tone: 'ok' });
  });
  test('special without an expiry date has no badge', () => expect(segmentBadge({ kind: 'special', daysLeft: null }).tone).toBe('none'));
});
