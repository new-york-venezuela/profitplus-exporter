import { describe, test, expect } from 'bun:test';
import { parseLocationPatch, normalizeCoCli } from '@/lib/geo/location-patch';

describe('parseLocationPatch', () => {
  test('coordinates only → canonical campo1', () => {
    expect(parseLocationPatch({ lat: 10.4806, lng: -66.9036 })).toEqual({
      ok: true,
      value: { coordinates: { lat: 10.4806, lng: -66.9036 }, campo1: 'Coordenadas: (10.480600, -66.903600)' },
    });
  });
  test('address only is trimmed', () => {
    expect(parseLocationPatch({ dirEnt2: '  Av. Principal  ' })).toEqual({ ok: true, value: { dirEnt2: 'Av. Principal' } });
  });
  test('both together', () => {
    const r = parseLocationPatch({ lat: 10, lng: -66, dirEnt2: 'X' });
    expect(r.ok && r.value.campo1 && r.value.dirEnt2).toBe('X');
  });
  test('only one of lat/lng is rejected with a coordinates field error', () => {
    expect(parseLocationPatch({ lat: 10 })).toMatchObject({ ok: false, field: 'coordinates' });
    expect(parseLocationPatch({ lng: -66 })).toMatchObject({ ok: false, field: 'coordinates' });
  });
  test('non-numbers and NaN are rejected', () => {
    expect(parseLocationPatch({ lat: '10', lng: -66 })).toMatchObject({ ok: false, field: 'coordinates' });
    expect(parseLocationPatch({ lat: NaN, lng: -66 })).toMatchObject({ ok: false, field: 'coordinates' });
  });
  test('swapped pair is rejected with the Spanish swapped message', () => {
    const r = parseLocationPatch({ lat: -66.9, lng: 10.5 });
    expect(r).toMatchObject({ ok: false, field: 'coordinates' });
    expect(!r.ok && r.error).toContain('invertid');
  });
  test('outside Venezuela is rejected', () => {
    const r = parseLocationPatch({ lat: 40.4, lng: -3.7 });
    expect(r).toMatchObject({ ok: false, field: 'coordinates' });
    expect(!r.ok && r.error).toContain('Venezuela');
  });
  test('empty body, non-objects, blank or over-long address are rejected', () => {
    expect(parseLocationPatch({}).ok).toBe(false);
    expect(parseLocationPatch(null).ok).toBe(false);
    expect(parseLocationPatch({ dirEnt2: '   ' })).toMatchObject({ ok: false, field: 'dirEnt2' });
    expect(parseLocationPatch({ dirEnt2: 'x'.repeat(501) })).toMatchObject({ ok: false, field: 'dirEnt2' });
  });
});

describe('normalizeCoCli', () => {
  test('decodes and trims', () => expect(normalizeCoCli('%20C001%20')).toBe('C001'));
  test('rejects empty, >16 chars and bad encoding', () => {
    expect(normalizeCoCli('   ')).toBeNull();
    expect(normalizeCoCli('x'.repeat(17))).toBeNull();
    expect(normalizeCoCli('x'.repeat(16))).toBe('x'.repeat(16));
    expect(normalizeCoCli('%E0%A4%A')).toBeNull();
  });
});
