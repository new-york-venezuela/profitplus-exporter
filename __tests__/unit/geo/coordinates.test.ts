import { describe, test, expect } from 'bun:test';
import {
  parseCoordinates, validateCoordinates, formatCoordinates, coordinateErrorMessage,
} from '@/lib/geo/coordinates';

describe('parseCoordinates', () => {
  test('parses the canonical form', () => {
    expect(parseCoordinates('Coordenadas: (10.4806, -66.9036)')).toEqual({ lat: 10.4806, lng: -66.9036 });
  });
  test('tolerates odd spacing, case, and char() padding', () => {
    expect(parseCoordinates('  coordenadas :( 10.5 ,-66.9 )      ')).toEqual({ lat: 10.5, lng: -66.9 });
  });
  test('integers are accepted', () => {
    expect(parseCoordinates('Coordenadas: (10, -66)')).toEqual({ lat: 10, lng: -66 });
  });
  test('null, undefined, empty and unrelated text return null, never throw', () => {
    expect(parseCoordinates(null)).toBeNull();
    expect(parseCoordinates(undefined)).toBeNull();
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('   ')).toBeNull();
    expect(parseCoordinates('Cliente VIP, llamar antes')).toBeNull();
    expect(parseCoordinates('Coordenadas: (10.5)')).toBeNull();
    expect(parseCoordinates('Coordenadas: (a, b)')).toBeNull();
    expect(parseCoordinates('(10.5, -66.9)')).toBeNull();
  });
  test('decimal comma is rejected (ambiguous with the separator)', () => {
    expect(parseCoordinates('Coordenadas: (10,48, -66,90)')).toBeNull();
  });
});

describe('validateCoordinates', () => {
  test('Caracas is valid', () => {
    expect(validateCoordinates({ lat: 10.4806, lng: -66.9036 })).toEqual({ ok: true });
  });
  test('swapped lat/lng inside Venezuela is flagged SWAPPED_SUSPECTED', () => {
    expect(validateCoordinates({ lat: -66.9036, lng: 10.4806 })).toEqual({ ok: false, error: 'SWAPPED_SUSPECTED' });
  });
  test('the brainstorming example (102.09, 3.123) is OUT_OF_RANGE, not swapped', () => {
    expect(validateCoordinates({ lat: 102.09, lng: 3.123 })).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
  });
  test('a point in the ocean is OUT_OF_RANGE', () => {
    expect(validateCoordinates({ lat: 30, lng: -40 })).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
  });
  test('NaN / Infinity are OUT_OF_RANGE', () => {
    expect(validateCoordinates({ lat: NaN, lng: -66 })).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
    expect(validateCoordinates({ lat: 10, lng: Infinity })).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
  });
  test('box edges are inclusive', () => {
    expect(validateCoordinates({ lat: 0.6, lng: -73.4 })).toEqual({ ok: true });
    expect(validateCoordinates({ lat: 12.3, lng: -59.8 })).toEqual({ ok: true });
  });
});

describe('formatCoordinates', () => {
  test('canonical 6-decimal form', () => {
    expect(formatCoordinates({ lat: 10.4806, lng: -66.9036 })).toBe('Coordenadas: (10.480600, -66.903600)');
  });
  test('round-trips through parseCoordinates', () => {
    const c = { lat: 10.123456, lng: -66.654321 };
    expect(parseCoordinates(formatCoordinates(c))).toEqual(c);
  });
  test('always fits the varchar(60) column, even at the extremes', () => {
    expect(formatCoordinates({ lat: -12.345678, lng: -123.456789 }).length).toBeLessThanOrEqual(60);
  });
});

describe('coordinateErrorMessage', () => {
  test('gives Spanish, user-facing text per error', () => {
    expect(coordinateErrorMessage('SWAPPED_SUSPECTED')).toContain('invertid');
    expect(coordinateErrorMessage('OUT_OF_RANGE')).toContain('Venezuela');
  });
});
