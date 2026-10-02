import { describe, test, expect } from 'bun:test';
import { buildSegmentName } from '@/lib/pricing/segment-name';

describe('special price name preview', () => {
  test('matches what the server will write', () => {
    expect(buildSegmentName({ customerName: 'Bodega El Sol', reason: 'promo oct', endsOn: '2026-10-31', today: '2026-10-01' }))
      .toBe('Bodega El Sol · promo oct · hasta 31/10');
  });
  test('a 100-char customer still previews within the ERP limit', () => {
    const name = buildSegmentName({ customerName: 'X'.repeat(100), reason: 'promo octubre larga', endsOn: '2027-01-15', today: '2026-10-01' });
    expect(name.length).toBeLessThanOrEqual(60);
  });
});
