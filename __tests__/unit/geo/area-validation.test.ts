import { describe, test, expect } from 'bun:test';
import { parseAreaCreate, parseAreaPatch } from '@/lib/geo/area-validation';

const ring: [number, number][] = [[0, 0], [2, 0], [2, 2], [0, 2]];

describe('parseAreaCreate', () => {
  test('accepts and trims; dedupes seller codes', () => {
    const r = parseAreaCreate({ name: ' Norte ', color: '#1D4ED8', ring, sellerCodes: [' 000001 ', '000001', '000002'] });
    expect(r).toEqual({ ok: true, value: { name: 'Norte', color: '#1D4ED8', ring, sellerCodes: ['000001', '000002'] } });
  });
  test('sellerCodes may be empty (area drawn before assigning)', () => {
    expect(parseAreaCreate({ name: 'N', color: '#000000', ring, sellerCodes: [] }).ok).toBe(true);
  });
  test('rejects bad shapes', () => {
    const base = { name: 'N', color: '#000000', ring, sellerCodes: [] };
    for (const body of [null, 'x', [], { ...base, name: '  ' }, { ...base, name: 'x'.repeat(81) },
      { ...base, color: 'red' }, { ...base, color: '#12345' }, { ...base, ring: 'x' }, { ...base, ring: [[0, 0], [1]] },
      { ...base, ring: [[0, 0], [1, 'a'], [2, 2]] }, { ...base, ring: Array.from({ length: 501 }, (_, i) => [i / 1000, 0]) },
      { ...base, sellerCodes: 'a' }, { ...base, sellerCodes: [''] }, { ...base, sellerCodes: Array.from({ length: 101 }, (_, i) => `S${i}`) }]) {
      expect(parseAreaCreate(body).ok).toBe(false);
    }
  });
});

describe('parseAreaPatch', () => {
  test('any subset', () => {
    expect(parseAreaPatch({ name: 'X' })).toEqual({ ok: true, value: { name: 'X' } });
    expect(parseAreaPatch({ sellerCodes: ['1'] })).toEqual({ ok: true, value: { sellerCodes: ['1'] } });
    expect(parseAreaPatch({ ring }).ok).toBe(true);
  });
  test('rejects empty patch and invalid fields', () => {
    expect(parseAreaPatch({}).ok).toBe(false);
    expect(parseAreaPatch({ color: 'blue' }).ok).toBe(false);
    expect(parseAreaPatch(null).ok).toBe(false);
  });
});
