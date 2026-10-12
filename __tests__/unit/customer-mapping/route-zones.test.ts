import { describe, test, expect } from 'bun:test';
import {
  parseRouteNumber, routeNumberFromZone, routeZoneCode, routeZoneName,
} from '../../../lib/customer-mapping/route-zones';

describe('parseRouteNumber', () => {
  test('numbers, numeric text and "Ruta N" text', () => {
    expect(parseRouteNumber(5)).toBe(5);
    expect(parseRouteNumber(5.0)).toBe(5);
    expect(parseRouteNumber(' 5 ')).toBe(5);
    expect(parseRouteNumber('Ruta 12')).toBe(12);
    expect(parseRouteNumber('ruta12')).toBe(12);
    expect(parseRouteNumber('022')).toBe(22);
  });
  test('blank, non-integer, out of range and garbage are null', () => {
    for (const bad of [null, undefined, '', '  ', 'abc', 0, '0', 1000, '1000', 2.5, -3, 'Ruta', {}, NaN]) {
      expect(parseRouteNumber(bad)).toBeNull();
    }
  });
});

describe('route zone codes', () => {
  test('code fits char(6), is zero padded and has no hyphen', () => {
    expect(routeZoneCode(3)).toBe('CCS003');
    expect(routeZoneCode(22)).toBe('CCS022');
    expect(routeZoneCode(999)).toBe('CCS999');
    for (const n of [1, 3, 22, 999]) expect(routeZoneCode(n)).toHaveLength(6);
  });
  test('never collides with the legacy CCS-NN zones', () => {
    for (const legacy of ['CCS-02', 'CCS-05', 'CCS-11', 'CCS-18', 'CCS-23', 'CCS-25', 'CCS']) {
      for (let n = 1; n <= 999; n++) expect(routeZoneCode(n)).not.toBe(legacy);
    }
  });
  test('out of range throws', () => {
    expect(() => routeZoneCode(0)).toThrow(RangeError);
    expect(() => routeZoneCode(1000)).toThrow(RangeError);
    expect(() => routeZoneCode(1.5)).toThrow(RangeError);
  });
  test('names and reverse lookup', () => {
    expect(routeZoneName(11)).toBe('Ruta 11');
    expect(routeNumberFromZone('CCS003')).toBe(3);
    expect(routeNumberFromZone('CCS003 ')).toBe(3);
    expect(routeNumberFromZone('CCS-11')).toBeNull();
    expect(routeNumberFromZone('CCS')).toBeNull();
    expect(routeNumberFromZone('CCS000')).toBeNull();
    expect(routeNumberFromZone('ccs003')).toBeNull();
    expect(routeNumberFromZone(null)).toBeNull();
  });
});
