import { describe, test, expect } from 'bun:test';
import { buildSegmentName, formatShortDate, nextTipCliCode } from '@/lib/pricing/segment-name';

const today = '2026-10-01';

describe('buildSegmentName', () => {
  test('short inputs are not truncated', () => {
    expect(buildSegmentName({ customerName: 'Bodega El Sol', reason: 'promo oct', endsOn: '2026-10-31', today }))
      .toBe('Bodega El Sol · promo oct · hasta 31/10');
  });
  test('other-year end date shows a 2-digit year', () => {
    expect(formatShortDate('2027-01-05', today)).toBe('05/01/27');
  });
  test('empty reason omits the reason segment', () => {
    expect(buildSegmentName({ customerName: 'Bodega El Sol', reason: '  ', endsOn: '2026-10-31', today }))
      .toBe('Bodega El Sol · hasta 31/10');
  });
  test('never exceeds 60 chars and always keeps the end date', () => {
    const customer = 'Distribuidora Comercial Internacional de Alimentos y Bebidas del Centro C.A.'.repeat(2);
    const reason = 'liquidación de inventario por cambio de presentación';
    for (const endsOn of ['2026-10-31', '2027-12-01']) {
      const name = buildSegmentName({ customerName: customer, reason, endsOn, today });
      expect(name.length).toBeLessThanOrEqual(60);
      expect(name.endsWith(`hasta ${formatShortDate(endsOn, today)}`)).toBe(true);
      expect(name).toContain('…');
    }
  });
  test('customer is shortened before the reason', () => {
    const name = buildSegmentName({ customerName: 'A'.repeat(80), reason: 'promo oct', endsOn: '2026-10-31', today });
    expect(name).toContain('promo oct');
  });
});

describe('nextTipCliCode', () => {
  test('starts at 000001 when empty', () => expect(nextTipCliCode([])).toBe('000001'));
  test('goes beyond the highest numeric code, ignoring non-numeric ones', () => {
    expect(nextTipCliCode(['000001', '000002', '02', 'TP1151'])).toBe('000003');
  });
  test('short numeric codes count (price-list-style codes from the old feature)', () => {
    expect(nextTipCliCode(['08', '10'])).toBe('000011');
  });
  test('trims padding', () => expect(nextTipCliCode(['000005  '])).toBe('000006'));
  test('throws when the space is exhausted', () => {
    expect(() => nextTipCliCode(['999999'])).toThrow();
  });
});
