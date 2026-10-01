import { describe, test, expect } from 'bun:test';
import {
  normalizeRing, validatePolygon, pointInPolygon, polygonsOverlap, interiorPoint,
  toGeoJsonPolygon, fromGeoJsonPolygon, ringToLatLngs, ringFromLatLngs, polygonErrorMessage, type Ring,
} from '@/lib/geo/geometry';

const square: Ring = [[0, 0], [2, 0], [2, 2], [0, 2]];
const squareCw: Ring = [[0, 0], [0, 2], [2, 2], [2, 0]];
const lShape: Ring = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];
const shift = (r: Ring, dx: number, dy: number): Ring => r.map(([x, y]) => [x + dx, y + dy]);

describe('normalizeRing', () => {
  test('drops a repeated closing point and consecutive duplicates', () => {
    expect(normalizeRing([[0, 0], [2, 0], [2, 0], [2, 2], [0, 0]])).toEqual([[0, 0], [2, 0], [2, 2]]);
  });
});

describe('validatePolygon', () => {
  test('accepts clockwise and counter-clockwise, open or closed', () => {
    expect(validatePolygon(square)).toEqual({ ok: true });
    expect(validatePolygon(squareCw)).toEqual({ ok: true });
    expect(validatePolygon([...square, square[0]])).toEqual({ ok: true });
    expect(validatePolygon(lShape)).toEqual({ ok: true });
  });
  test('rejects fewer than 3 distinct vertices', () => {
    expect(validatePolygon([[0, 0], [1, 1]])).toEqual({ ok: false, error: 'TOO_FEW_VERTICES' });
    expect(validatePolygon([[0, 0], [0, 0], [1, 1]])).toEqual({ ok: false, error: 'TOO_FEW_VERTICES' });
  });
  test('rejects a bow-tie', () => {
    expect(validatePolygon([[0, 0], [2, 2], [2, 0], [0, 2]])).toEqual({ ok: false, error: 'SELF_INTERSECTING' });
  });
  test('rejects collinear (zero area) points', () => {
    expect(validatePolygon([[0, 0], [1, 1], [2, 2]])).toEqual({ ok: false, error: 'ZERO_AREA' });
  });
  test('rejects a spike that doubles back on itself', () => {
    expect(validatePolygon([[0, 0], [4, 0], [4, 4], [4, 0.0], [2, 3]])).toMatchObject({ ok: false });
  });
  test('rejects NaN/Infinity and impossible lat/lng', () => {
    expect(validatePolygon([[0, 0], [NaN, 1], [1, 1]])).toEqual({ ok: false, error: 'NON_FINITE' });
    expect(validatePolygon([[0, 0], [1, 91], [2, 0]])).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
    expect(validatePolygon([[181, 0], [1, 1], [2, 0]])).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
  });
});

describe('pointInPolygon', () => {
  test('inside / outside', () => {
    expect(pointInPolygon([1, 1], square)).toBe(true);
    expect(pointInPolygon([3, 1], square)).toBe(false);
  });
  test('same answer for either winding', () => {
    expect(pointInPolygon([1, 1], squareCw)).toBe(true);
  });
  test('concave: a point in the notch of an L is outside', () => {
    expect(pointInPolygon([3, 3], lShape)).toBe(false);
    expect(pointInPolygon([1, 3], lShape)).toBe(true);
  });
  test('boundary and vertex: inside by default, outside on request', () => {
    expect(pointInPolygon([1, 0], square)).toBe(true);
    expect(pointInPolygon([0, 0], square)).toBe(true);
    expect(pointInPolygon([1, 0], square, 'outside')).toBe(false);
    expect(pointInPolygon([0, 0], square, 'outside')).toBe(false);
  });
});

describe('interiorPoint', () => {
  test('is strictly inside convex and concave polygons', () => {
    for (const ring of [square, squareCw, lShape, [[0, 0], [10, 0], [5, 8]] as Ring]) {
      expect(pointInPolygon(interiorPoint(ring), ring, 'outside')).toBe(true);
    }
  });
});

describe('polygonsOverlap', () => {
  test('disjoint → false', () => expect(polygonsOverlap(square, shift(square, 5, 0))).toBe(false));
  test('neighbours sharing a full edge → false', () => expect(polygonsOverlap(square, shift(square, 2, 0))).toBe(false));
  test('neighbours sharing only a corner → false', () => expect(polygonsOverlap(square, shift(square, 2, 2))).toBe(false));
  test('partially overlapping (edges cross) → true', () => expect(polygonsOverlap(square, shift(square, 1, 1))).toBe(true));
  test('one nested inside the other → true, both directions', () => {
    const inner: Ring = [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]];
    expect(polygonsOverlap(square, inner)).toBe(true);
    expect(polygonsOverlap(inner, square)).toBe(true);
  });
  test('identical → true', () => expect(polygonsOverlap(square, [...square])).toBe(true));
  test('diamond whose vertices all touch the square\'s sides → true (no strictly-inside vertex, no crossing)', () => {
    const diamond: Ring = [[1, 0], [2, 1], [1, 2], [0, 1]];
    expect(polygonsOverlap(square, diamond)).toBe(true);
    expect(polygonsOverlap(diamond, square)).toBe(true);
  });
  test('half-rectangle sharing the square\'s boundary → true', () => {
    expect(polygonsOverlap(square, [[0, 0], [1, 0], [1, 2], [0, 2]])).toBe(true);
  });
  test('rectangles shifted along a shared band (all vertices on the other\'s boundary) → true', () => {
    expect(polygonsOverlap(shift(square, 1, 0), shift(square, 2, 0))).toBe(true);
    expect(polygonsOverlap(shift(square, 2, 0), shift(square, 1, 0))).toBe(true);
  });
  test('either winding gives the same answer', () => {
    expect(polygonsOverlap(squareCw, shift(square, 1, 1))).toBe(true);
    expect(polygonsOverlap(squareCw, shift(square, 2, 0))).toBe(false);
  });
});

describe('GeoJSON round trip', () => {
  test('stores a closed ring and reads back the open ring', () => {
    const text = toGeoJsonPolygon(square);
    const parsed = JSON.parse(text);
    expect(parsed.type).toBe('Polygon');
    expect(parsed.coordinates[0].at(-1)).toEqual(parsed.coordinates[0][0]);
    expect(fromGeoJsonPolygon(text)).toEqual(square);
  });
  test('garbage → null, never throws', () => {
    for (const bad of ['', 'nope', '{}', '{"type":"Point","coordinates":[1,2]}', '{"type":"Polygon","coordinates":[]}',
      '{"type":"Polygon","coordinates":[[[0,0],[1,"x"],[2,2]]]}']) expect(fromGeoJsonPolygon(bad)).toBeNull();
  });
});

describe('Leaflet boundary helpers', () => {
  test('swap axes and drop the nested array', () => {
    expect(ringToLatLngs([[-66, 10], [-65, 10], [-65, 11]])).toEqual([[10, -66], [10, -65], [11, -65]]);
    expect(ringFromLatLngs([[{ lat: 10, lng: -66 }, { lat: 10, lng: -65 }, { lat: 11, lng: -65 }]])).toEqual([[-66, 10], [-65, 10], [-65, 11]]);
    expect(ringFromLatLngs([{ lat: 10, lng: -66 }, { lat: 10, lng: -65 }, { lat: 11, lng: -65 }])).toEqual([[-66, 10], [-65, 10], [-65, 11]]);
  });
});

describe('polygonErrorMessage', () => {
  test('Spanish text per error', () => {
    expect(polygonErrorMessage('SELF_INTERSECTING')).toContain('cruz');
    expect(polygonErrorMessage('TOO_FEW_VERTICES')).toContain('3');
  });
});
