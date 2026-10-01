import { describe, test, expect } from 'bun:test';
import { applyAreaMatch, areaRevenue } from '@/lib/geo/area-match';
import type { AreaDto } from '@/lib/geo/areas-repo';
import type { MapCustomer } from '@/lib/geo/types';

const cust = (over: Partial<MapCustomer> & { coCli: string }): MapCustomer => ({
  name: over.coCli, rif: null, coVen: '000001', sellerName: 'Ana', direc1: null, dirEnt2: null,
  lat: null, lng: null, coordinatesIssue: null, revenueBs: 0, revenueUsd: 0, pareto: null, routeIds: [],
  areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false, ...over,
});

// ring is [lng, lat]
const west: AreaDto = { id: 1, name: 'Oeste', color: '#111111', ring: [[-68, 9], [-66, 9], [-66, 11], [-68, 11]], sellerCodes: ['000001'] };
const east: AreaDto = { id: 2, name: 'Este', color: '#222222', ring: [[-66, 9], [-64, 9], [-64, 11], [-66, 11]], sellerCodes: ['000002', '000003'] };
const noSellers: AreaDto = { id: 3, name: 'Libre', color: '#333333', ring: [[-70, 9], [-68.5, 9], [-68.5, 11], [-70, 11]], sellerCodes: [] };

describe('applyAreaMatch', () => {
  test('matches by point in polygon (customer lat/lng → ring [lng, lat])', () => {
    const [c] = applyAreaMatch([cust({ coCli: 'A', lat: 10, lng: -67 })], [west, east]);
    expect(c).toMatchObject({ areaId: 1, areaName: 'Oeste', areaSellerCodes: ['000001'], sellerMismatch: false });
  });
  test('flags a mismatch when the customer\'s seller is not among the area\'s sellers', () => {
    const [c] = applyAreaMatch([cust({ coCli: 'A', lat: 10, lng: -65, coVen: '000001' })], [west, east]);
    expect(c).toMatchObject({ areaId: 2, sellerMismatch: true });
  });
  test('any of several sellers satisfies the area', () => {
    const [c] = applyAreaMatch([cust({ coCli: 'A', lat: 10, lng: -65, coVen: '000003' })], [west, east]);
    expect(c.sellerMismatch).toBe(false);
  });
  test('an area with no sellers never produces a mismatch', () => {
    const [c] = applyAreaMatch([cust({ coCli: 'A', lat: 10, lng: -69, coVen: '000009' })], [noSellers]);
    expect(c).toMatchObject({ areaId: 3, sellerMismatch: false });
  });
  test('outside every area, or without coordinates: no match and no mismatch', () => {
    const rows = applyAreaMatch([cust({ coCli: 'A', lat: 5, lng: -60 }), cust({ coCli: 'B' })], [west, east]);
    for (const r of rows) expect(r).toMatchObject({ areaId: null, areaName: null, areaSellerCodes: [], sellerMismatch: false });
  });
  test('a customer exactly on the shared border matches the lowest area id, once', () => {
    const [c] = applyAreaMatch([cust({ coCli: 'A', lat: 10, lng: -66 })], [east, west]);   // input order must not matter
    expect(c.areaId).toBe(1);
  });
  test('does not mutate its input', () => {
    const input = [cust({ coCli: 'A', lat: 10, lng: -67 })];
    applyAreaMatch(input, [west]);
    expect(input[0].areaId).toBeNull();
  });
});

describe('areaRevenue', () => {
  test('sums USD per area, counts customers, includes empty areas, ignores unmatched', () => {
    const matched = applyAreaMatch([
      cust({ coCli: 'A', lat: 10, lng: -67, revenueUsd: 100 }),
      cust({ coCli: 'B', lat: 10, lng: -67, revenueUsd: 50 }),
      cust({ coCli: 'C', lat: 10, lng: -65, revenueUsd: null }),
      cust({ coCli: 'D', lat: 5, lng: -60, revenueUsd: 999 }),
    ], [west, east]);
    const stats = areaRevenue(matched, [west, east, noSellers]);
    expect(stats.get(1)).toEqual({ areaId: 1, revenueUsd: 150, customers: 2 });
    expect(stats.get(2)).toEqual({ areaId: 2, revenueUsd: 0, customers: 1 });     // null USD counts as 0
    expect(stats.get(3)).toEqual({ areaId: 3, revenueUsd: 0, customers: 0 });
  });
});
