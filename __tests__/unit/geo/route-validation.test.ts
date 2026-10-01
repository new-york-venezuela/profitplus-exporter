import { describe, test, expect } from 'bun:test';
import { parseRouteCreate, parseRoutePatch } from '@/lib/geo/route-validation';

describe('parseRouteCreate', () => {
  test('accepts and trims', () => {
    expect(parseRouteCreate({ name: '  Ruta Lunes  ', sellerCode: ' 000001 ' }))
      .toEqual({ ok: true, value: { name: 'Ruta Lunes', sellerCode: '000001' } });
  });
  test('rejects non-objects, blank/long names and missing seller', () => {
    for (const body of [null, 'x', [], { sellerCode: '1' }, { name: '   ', sellerCode: '1' },
      { name: 'x'.repeat(81), sellerCode: '1' }, { name: 'ok' }, { name: 'ok', sellerCode: '' },
      { name: 'ok', sellerCode: 'x'.repeat(17) }, { name: 5, sellerCode: '1' }]) {
      expect(parseRouteCreate(body).ok).toBe(false);
    }
  });
});

describe('parseRoutePatch', () => {
  test('accepts any subset and dedupes/trims customerCodes', () => {
    expect(parseRoutePatch({ customerCodes: [' A ', 'A', 'B'] })).toEqual({ ok: true, value: { customerCodes: ['A', 'B'] } });
    expect(parseRoutePatch({ name: 'N' })).toEqual({ ok: true, value: { name: 'N' } });
    expect(parseRoutePatch({ customerCodes: [] })).toEqual({ ok: true, value: { customerCodes: [] } });
  });
  test('rejects empty patch, wrong types, blank codes and oversized lists', () => {
    for (const body of [{}, null, { name: '' }, { sellerCode: '' }, { customerCodes: 'A' },
      { customerCodes: ['A', ''] }, { customerCodes: [1] }, { customerCodes: Array.from({ length: 2001 }, (_, i) => `C${i}`) }]) {
      expect(parseRoutePatch(body).ok).toBe(false);
    }
  });
});
