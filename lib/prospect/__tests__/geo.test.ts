import { describe, expect, test } from 'bun:test';
import { distanceKm, nearestRoutes, routeCentroids, suggestRoute } from '../geo';

const caracas = { lat: 10.4806, lng: -66.9036 };

describe('distanceKm', () => {
  test('zero to itself, small to a nearby point', () => {
    expect(distanceKm(caracas, caracas)).toBe(0);
    const d = distanceKm(caracas, { lat: 10.5, lng: -66.9 });
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(5);
  });
});

describe('routeCentroids', () => {
  test('averages located customers and ignores unlocated or unrouted', () => {
    const c = routeCentroids([
      { routeNumber: 1, point: { lat: 10, lng: -66 } },
      { routeNumber: 1, point: { lat: 12, lng: -68 } },
      { routeNumber: 1, point: null },
      { routeNumber: null, point: { lat: 0, lng: 0 } },
      { routeNumber: 2, point: null },
    ]);
    expect(c.size).toBe(1);
    expect(c.get(1)).toEqual({ lat: 11, lng: -67 });
  });
});

describe('nearestRoutes', () => {
  const centroids = new Map([
    [1, { lat: 10.5, lng: -66.9 }],
    [2, { lat: 11, lng: -67 }],
    [3, { lat: 8, lng: -64 }],
  ]);
  test('orders by distance and respects n', () => {
    expect(nearestRoutes(caracas, centroids, 2)).toEqual([1, 2]);
    expect(nearestRoutes(caracas, centroids, 10)).toEqual([1, 2, 3]);
  });
});

describe('suggestRoute', () => {
  const at = (routeNumber: number, dLat: number) => ({
    routeNumber,
    point: { lat: caracas.lat + dLat, lng: caracas.lng },
  });
  test('majority beats single nearest', () => {
    expect(suggestRoute(caracas, [at(1, 0.001), at(2, 0.002), at(2, 0.003), at(3, 0.5)])).toBe(2);
  });
  test('tie goes to the nearest', () => {
    expect(suggestRoute(caracas, [at(1, 0.001), at(2, 0.002), at(3, 0.003)])).toBe(1);
    expect(suggestRoute(caracas, [at(2, 0.001), at(1, 0.002)], 2)).toBe(2);
  });
  test('null when no located routed customers', () => {
    expect(suggestRoute(caracas, [])).toBeNull();
    expect(suggestRoute(caracas, [{ routeNumber: 1, point: null }, { routeNumber: null, point: caracas }])).toBeNull();
  });
});
